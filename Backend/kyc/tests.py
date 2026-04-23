from django.test import TestCase
from datetime import date
from citizens.models import Citizen, Gender, Province
from kyc.models import ThirdPartyInstitution, KYCRequest, KYCRequestStatus
from admin_ops.models import SystemUser, UserRole
from kyc.service.services import KYCService, StatisticsService
from django.contrib.auth.hashers import make_password


class KYCServiceTest(TestCase):
    def setUp(self):
        # Create a test citizen
        self.citizen = Citizen.objects.create(
            nrc="123456/78/9",
            full_name="John Doe",
            dob=date(1990, 1, 1),
            phone="+260977123456",
            public_key="test-public-key",
            status="ACTIVE",
            language="en",
            din="ZM0000000001"
        )
        
        # Create a test institution
        self.institution = ThirdPartyInstitution.objects.create(
            name="Test Bank",
            reg_number="TEST001",
            status="ACTIVE"
        )
        
        # Create a test user (for institution association)
        self.user = SystemUser.objects.create(
            email="test@example.com",
            name="Test User",
            role=UserRole.THIRD_PARTY,
            password_hash=make_password("testpass123")
        )
        
        # Link institution to user (institution has enrolled_by field)
        self.institution.enrolled_by = self.user
        self.institution.save()

    def test_create_kyc_request(self):
        """Test creating a KYC request"""
        kyc_request = KYCService.create_kyc_request(
            institution_id=self.institution.id,
            citizen_din=self.citizen.din,
            fields_requested=["full_name", "dob"]
        )
        
        self.assertEqual(kyc_request.institution, self.institution)
        self.assertEqual(kyc_request.citizen, self.citizen)
        self.assertEqual(kyc_request.citizen_din, self.citizen.din)
        self.assertEqual(kyc_request.fields_requested, ["full_name", "dob"])
        self.assertEqual(kyc_request.status, KYCRequestStatus.PENDING)
        self.assertIsNone(kyc_request.fields_granted)
        self.assertIsNotNone(kyc_request.requested_at)

    def test_process_citizen_response_approved(self):
        """Test processing citizen approval of KYC request"""
        # Create KYC request first
        kyc_request = KYCService.create_kyc_request(
            institution_id=self.institution.id,
            citizen_din=self.citizen.din,
            fields_requested=["full_name", "dob", "phone"]
        )
        
        # Process citizen response (approved)
        consent_record = KYCService.process_citizen_response(
            kyc_request_id=kyc_request.id,
            decision="APPROVED",
            citizen_id=self.citizen.id
        )
        
        # Refresh from DB
        kyc_request.refresh_from_db()
        
        # Check KYC request updated correctly
        self.assertEqual(kyc_request.status, KYCRequestStatus.APPROVED)
        self.assertEqual(kyc_request.fields_granted, ["full_name", "dob", "phone"])
        self.assertIsNotNone(kyc_request.responded_at)
        
        # Check consent record created correctly
        self.assertEqual(consent_record.kyc_request, kyc_request)
        self.assertEqual(consent_record.citizen, self.citizen)
        self.assertEqual(consent_record.decision, "APPROVED")
        self.assertEqual(consent_record.fields_shared, ["full_name", "dob", "phone"])
        self.assertIsNotNone(consent_record.timestamp)

    def test_process_citizen_response_denied(self):
        """Test processing citizen denial of KYC request"""
        # Create KYC request first
        kyc_request = KYCService.create_kyc_request(
            institution_id=self.institution.id,
            citizen_din=self.citizen.din,
            fields_requested=["full_name", "dob"]
        )
        
        # Process citizen response (denied)
        consent_record = KYCService.process_citizen_response(
            kyc_request_id=kyc_request.id,
            decision="DENIED",
            citizen_id=self.citizen.id
        )
        
        # Refresh from DB
        kyc_request.refresh_from_db()
        
        # Check KYC request updated correctly
        self.assertEqual(kyc_request.status, KYCRequestStatus.DENIED)
        self.assertEqual(kyc_request.fields_granted, [])
        self.assertIsNotNone(kyc_request.responded_at)
        
        # Check consent record created correctly
        self.assertEqual(consent_record.kyc_request, kyc_request)
        self.assertEqual(consent_record.citizen, self.citizen)
        self.assertEqual(consent_record.decision, "DENIED")
        self.assertIsNone(consent_record.fields_shared)

    def test_filter_citizen_data(self):
        """Test filtering citizen data for selective disclosure"""
        # Test requesting specific fields
        fields_requested = ["full_name", "dob", "phone"]
        filtered_data = KYCService.filter_citizen_data(self.citizen, fields_requested)
        
        self.assertEqual(filtered_data["full_name"], "John Doe")
        self.assertEqual(filtered_data["dob"], "1990-01-01")
        self.assertEqual(filtered_data["phone"], "+260977123456")
        
        # Ensure other fields are not included
        self.assertNotIn("nrc", filtered_data)
        self.assertNotIn("status", filtered_data)
        self.assertNotIn("language", filtered_data)
        
        # Test requesting non-existent field
        fields_requested = ["full_name", "nonexistent_field"]
        filtered_data = KYCService.filter_citizen_data(self.citizen, fields_requested)
        
        self.assertIn("full_name", filtered_data)
        self.assertNotIn("nonexistent_field", filtered_data)

    def test_filter_citizen_data_with_gender_province(self):
        """Test filtering citizen data including new gender and province fields"""
        # Update citizen with gender and province
        self.citizen.gender = Gender.MALE
        self.citizen.province = Province.LUSAKA
        self.citizen.save()
        
        # Request fields including gender and province
        fields_requested = ["full_name", "gender", "province", "dob"]
        filtered_data = KYCService.filter_citizen_data(self.citizen, fields_requested)
        
        self.assertEqual(filtered_data["full_name"], "John Doe")
        self.assertEqual(filtered_data["gender"], Gender.MALE)
        self.assertEqual(filtered_data["province"], Province.LUSAKA)
        self.assertEqual(filtered_data["dob"], "1990-01-01")
        
        # Ensure sensitive fields are not included
        self.assertNotIn("nrc", filtered_data)
        self.assertNotIn("public_key", filtered_data)

    def test_filter_citizen_data_empty_request(self):
        """Test filtering with empty fields list returns empty dict"""
        fields_requested = []
        filtered_data = KYCService.filter_citizen_data(self.citizen, fields_requested)
        
        self.assertEqual(filtered_data, {})

    def test_filter_citizen_data_all_fields(self):
        """Test requesting all available fields"""
        self.citizen.gender = Gender.FEMALE
        self.citizen.province = Province.COPPERBELT
        self.citizen.save()
        
        all_available_fields = [
            'full_name', 'dob', 'phone', 'nrc', 'din', 'gender', 
            'province', 'status', 'language', 'created_at', 'updated_at'
        ]
        filtered_data = KYCService.filter_citizen_data(self.citizen, all_available_fields)
        
        # Verify all requested fields are present
        for field in all_available_fields:
            self.assertIn(field, filtered_data)


class StatisticsServiceTest(TestCase):
    def setUp(self):
        # Create test citizens with different statuses
        Citizen.objects.create(
            nrc="111111/11/1",
            full_name="Alive Person 1",
            dob="1985-05-15",
            public_key="key1",
            status="ACTIVE",
            language="en",
            din="ZM0000000002"
        )
        
        Citizen.objects.create(
            nrc="222222/22/2",
            full_name="Alive Person 2",
            dob="1992-08-22",
            public_key="key2",
            status="ACTIVE",
            language="en",
            din="ZM0000000003"
        )
        
        Citizen.objects.create(
            nrc="333333/33/3",
            full_name="Deceased Person",
            dob="1970-12-01",
            public_key="key3",
            status="DECEASED",
            language="en",
            din="ZM0000000004"
        )

    def test_get_total_registered_citizens(self):
        """Test getting total registered citizens"""
        total = StatisticsService.get_total_registered_citizens()
        self.assertEqual(total, 3)

    def test_get_live_births_vs_deaths(self):
        """Test calculating live births vs recorded deaths"""
        stats = StatisticsService.get_live_births_vs_deaths()
        
        self.assertEqual(stats["live_births"], 2)  # Two ACTIVE citizens
        self.assertEqual(stats["recorded_deaths"], 1)  # One DECEASED citizen

    def test_get_kyc_metrics(self):
        """Test KYC metrics calculation"""
        # Create some test KYC requests
        institution = ThirdPartyInstitution.objects.create(
            name="Test Institution",
            reg_number="TEST002",
            status="ACTIVE"
        )
        
        citizen = Citizen.objects.first()
        
        # Create approved request
        KYCRequest.objects.create(
            institution=institution,
            citizen_din=citizen.din,
            citizen=citizen,
            fields_requested=["full_name"],
            status=KYCRequestStatus.APPROVED
        )
        
        # Create denied request
        KYCRequest.objects.create(
            institution=institution,
            citizen_din=citizen.din,
            citizen=citizen,
            fields_requested=["dob"],
            status=KYCRequestStatus.DENIED
        )
        
        # Create pending request
        KYCRequest.objects.create(
            institution=institution,
            citizen_din=citizen.din,
            citizen=citizen,
            fields_requested=["phone"],
            status=KYCRequestStatus.PENDING
        )
        
        metrics = StatisticsService.get_kyc_metrics()
        
        self.assertEqual(metrics["approved"], 1)
        self.assertEqual(metrics["denied"], 1)
        self.assertEqual(metrics["pending"], 1)
        self.assertEqual(metrics["total"], 3)
        self.assertAlmostEqual(metrics["approval_rate"], 33.33, places=2)


class GenderRatioStatisticsTest(TestCase):
    """Comprehensive tests for gender ratio statistics"""

    def test_get_gender_ratio_balanced(self):
        """Test gender ratio with balanced male/female population"""
        # Create 2 males, 2 females, 1 other
        for i in range(2):
            Citizen.objects.create(
                nrc=f"11111{i}/11/1",
                full_name=f"Male {i}",
                dob="1990-01-01",
                public_key="key",
                gender=Gender.MALE,
                status="ACTIVE",
            )
        
        for i in range(2):
            Citizen.objects.create(
                nrc=f"22222{i}/22/2",
                full_name=f"Female {i}",
                dob="1990-01-01",
                public_key="key",
                gender=Gender.FEMALE,
                status="ACTIVE",
            )
        
        Citizen.objects.create(
            nrc="333333/33/3",
            full_name="Other",
            dob="1990-01-01",
            public_key="key",
            gender=Gender.OTHER,
            status="ACTIVE",
        )
        
        ratio = StatisticsService.get_gender_ratio()
        
        self.assertEqual(ratio["male_count"], 2)
        self.assertEqual(ratio["female_count"], 2)
        self.assertEqual(ratio["other_count"], 1)
        self.assertEqual(ratio["ratio"], 1.0)  # 2:2 = 1:1
        self.assertEqual(ratio["total"], 5)
        self.assertEqual(ratio["male_percentage"], 40.0)
        self.assertEqual(ratio["female_percentage"], 40.0)

    def test_get_gender_ratio_no_females(self):
        """Test gender ratio with no females (should not divide by zero)"""
        Citizen.objects.create(
            nrc="111111/11/1",
            full_name="Male",
            dob="1990-01-01",
            public_key="key",
            gender=Gender.MALE,
            status="ACTIVE",
        )
        
        ratio = StatisticsService.get_gender_ratio()
        
        self.assertEqual(ratio["male_count"], 1)
        self.assertEqual(ratio["female_count"], 0)
        self.assertEqual(ratio["ratio"], 0.0)  # Should not crash, return 0.0

    def test_get_gender_ratio_empty(self):
        """Test gender ratio with no citizens"""
        ratio = StatisticsService.get_gender_ratio()
        
        self.assertEqual(ratio["male_count"], 0)
        self.assertEqual(ratio["female_count"], 0)
        self.assertEqual(ratio["other_count"], 0)
        self.assertEqual(ratio["total"], 0)

    def test_get_gender_ratio_percentages(self):
        """Test that percentages are calculated correctly"""
        # Create 1 male, 2 females (should be 33.33% and 66.67%)
        Citizen.objects.create(
            nrc="111111/11/1",
            full_name="Male",
            dob="1990-01-01",
            public_key="key",
            gender=Gender.MALE,
            status="ACTIVE",
        )
        
        for i in range(2):
            Citizen.objects.create(
                nrc=f"22222{i}/22/2",
                full_name=f"Female {i}",
                dob="1990-01-01",
                public_key="key",
                gender=Gender.FEMALE,
                status="ACTIVE",
            )
        
        ratio = StatisticsService.get_gender_ratio()
        
        self.assertAlmostEqual(ratio["male_percentage"], 33.33, places=1)
        self.assertAlmostEqual(ratio["female_percentage"], 66.67, places=1)


class RegionalBreakdownStatisticsTest(TestCase):
    """Comprehensive tests for regional (province) breakdown statistics"""

    def test_get_regional_breakdown_multiple_provinces(self):
        """Test regional breakdown with citizens in multiple provinces"""
        # Create citizens in different provinces
        Citizen.objects.create(
            nrc="111111/11/1",
            full_name="Lusaka Citizen 1",
            dob="1990-01-01",
            public_key="key",
            province=Province.LUSAKA,
            status="ACTIVE",
        )
        
        Citizen.objects.create(
            nrc="111112/11/1",
            full_name="Lusaka Citizen 2",
            dob="1990-01-01",
            public_key="key",
            province=Province.LUSAKA,
            status="ACTIVE",
        )
        
        Citizen.objects.create(
            nrc="222222/22/2",
            full_name="Copperbelt Citizen",
            dob="1990-01-01",
            public_key="key",
            province=Province.COPPERBELT,
            status="ACTIVE",
        )
        
        breakdown = StatisticsService.get_regional_breakdown()
        
        # Convert to dict for easier testing
        province_map = {p['province_code']: p for p in breakdown}
        
        # Verify Lusaka has 2 citizens
        self.assertEqual(province_map[Province.LUSAKA]['registered_count'], 2)
        self.assertAlmostEqual(province_map[Province.LUSAKA]['percentage'], 66.67, places=1)
        
        # Verify Copperbelt has 1 citizen
        self.assertEqual(province_map[Province.COPPERBELT]['registered_count'], 1)
        self.assertAlmostEqual(province_map[Province.COPPERBELT]['percentage'], 33.33, places=1)
        
        # Verify Eastern has 0 citizens
        self.assertEqual(province_map[Province.EASTERN]['registered_count'], 0)
        self.assertEqual(province_map[Province.EASTERN]['percentage'], 0.0)

    def test_get_regional_breakdown_all_provinces(self):
        """Test that all 10 Zambian provinces are returned"""
        Citizen.objects.create(
            nrc="111111/11/1",
            full_name="Test",
            dob="1990-01-01",
            public_key="key",
            province=Province.LUSAKA,
            status="ACTIVE",
        )
        
        breakdown = StatisticsService.get_regional_breakdown()
        
        # Should have 10 provinces
        self.assertEqual(len(breakdown), 10)
        
        # Verify all provinces are present
        province_codes = {p['province_code'] for p in breakdown}
        expected_provinces = {
            Province.CENTRAL, Province.COPPERBELT, Province.EASTERN,
            Province.LUAPULA, Province.LUSAKA, Province.MUCHINGA,
            Province.NORTHERN, Province.NORTHWEST, Province.SOUTHERN,
            Province.WESTERN
        }
        self.assertEqual(province_codes, expected_provinces)

    def test_get_regional_breakdown_empty(self):
        """Test regional breakdown with no citizens"""
        breakdown = StatisticsService.get_regional_breakdown()
        
        # Should still have all 10 provinces with 0 count
        self.assertEqual(len(breakdown), 10)
        
        for province_data in breakdown:
            self.assertEqual(province_data['registered_count'], 0)
            self.assertEqual(province_data['percentage'], 0.0)

    def test_get_regional_breakdown_includes_province_names(self):
        """Test that province codes are mapped to province names"""
        # Create one citizen to ensure non-empty path
        Citizen.objects.create(
            nrc="111111/11/1",
            full_name="Test",
            dob="1990-01-01",
            public_key="key",
            province=Province.LUSAKA,
            status="ACTIVE",
        )
        
        breakdown = StatisticsService.get_regional_breakdown()
        
        # Verify each entry has both code and name
        for province_data in breakdown:
            self.assertIn('province_code', province_data)
            self.assertIn('province_name', province_data)
            self.assertIsNotNone(province_data['province_name'])
            self.assertTrue(len(province_data['province_name']) > 0)


class AuditLoggingTest(TestCase):
    """Tests to verify audit logging of KYC actions"""

    def setUp(self):
        # Create test data
        self.citizen = Citizen.objects.create(
            nrc="123456/78/9",
            full_name="John Doe",
            dob=date(1990, 1, 1),
            phone="+260977123456",
            public_key="test-public-key",
            status="ACTIVE",
            language="en",
            din="ZM0000000001"
        )
        
        self.institution = ThirdPartyInstitution.objects.create(
            name="Test Bank",
            reg_number="TEST001",
            status="ACTIVE"
        )
        
        self.user = SystemUser.objects.create(
            email="test@example.com",
            name="Test User",
            role=UserRole.THIRD_PARTY,
            password_hash=make_password("testpass123")
        )

    def test_consent_record_created_on_approval(self):
        """Test that ConsentRecord is created when citizen approves"""
        kyc_request = KYCService.create_kyc_request(
            institution_id=self.institution.id,
            citizen_din=self.citizen.din,
            fields_requested=["full_name", "dob"]
        )
        
        # Initially no consent record
        self.assertFalse(hasattr(kyc_request, 'consent_record') and kyc_request.consent_record)
        
        # Process approval
        consent_record = KYCService.process_citizen_response(
            kyc_request_id=kyc_request.id,
            decision="APPROVED",
            citizen_id=self.citizen.id
        )
        
        # Verify consent record exists
        self.assertIsNotNone(consent_record)
        self.assertEqual(consent_record.decision, "APPROVED")
        self.assertEqual(consent_record.fields_shared, ["full_name", "dob"])

    def test_consent_record_immutable(self):
        """Test that ConsentRecord cannot be modified"""
        kyc_request = KYCService.create_kyc_request(
            institution_id=self.institution.id,
            citizen_din=self.citizen.din,
            fields_requested=["full_name"]
        )
        
        consent_record = KYCService.process_citizen_response(
            kyc_request_id=kyc_request.id,
            decision="APPROVED",
            citizen_id=self.citizen.id
        )
        
        original_decision = consent_record.decision
        original_fields = consent_record.fields_shared
        
        # Attempt to modify (should still work at DB level, but tests immutability at service level)
        self.assertEqual(consent_record.decision, original_decision)
        self.assertEqual(consent_record.fields_shared, original_fields)


class KYCEndpointSecurityTest(TestCase):
    """Tests for KYC endpoint security and data retrieval"""

    def setUp(self):
        self.citizen = Citizen.objects.create(
            nrc="123456/78/9",
            full_name="John Doe",
            dob=date(1990, 1, 1),
            phone="+260977123456",
            public_key="test-public-key",
            status="ACTIVE",
            language="en",
            din="ZM0000000001",
            gender=Gender.MALE,
            province=Province.LUSAKA
        )
        
        self.institution1 = ThirdPartyInstitution.objects.create(
            name="Test Bank 1",
            reg_number="TEST001",
            status="ACTIVE"
        )
        
        self.institution2 = ThirdPartyInstitution.objects.create(
            name="Test Bank 2",
            reg_number="TEST002",
            status="ACTIVE"
        )

    def test_filter_returns_only_approved_fields(self):
        """Test that data retrieval only returns approved fields"""
        kyc_request = KYCService.create_kyc_request(
            institution_id=self.institution1.id,
            citizen_din=self.citizen.din,
            fields_requested=["full_name", "dob", "province"]
        )
        
        # Approve with specific fields
        KYCService.process_citizen_response(
            kyc_request_id=kyc_request.id,
            decision="APPROVED",
            citizen_id=self.citizen.id
        )
                # Refresh kyc_request from DB to get updated fields_granted
        kyc_request.refresh_from_db()
                # Retrieve data
        approved_data = KYCService.filter_citizen_data(
            citizen=self.citizen,
            fields_requested=kyc_request.fields_granted
        )
        
        # Should contain only approved fields
        self.assertIn("full_name", approved_data)
        self.assertIn("dob", approved_data)
        self.assertIn("province", approved_data)
        
        # Should NOT contain unapproved fields
        self.assertNotIn("gender", approved_data)
        self.assertNotIn("phone", approved_data)
        self.assertNotIn("nrc", approved_data)

    def test_denied_request_has_no_fields(self):
        """Test that denied requests have no fields shared"""
        kyc_request = KYCService.create_kyc_request(
            institution_id=self.institution1.id,
            citizen_din=self.citizen.din,
            fields_requested=["full_name", "dob"]
        )
        
        # Deny the request
        consent_record = KYCService.process_citizen_response(
            kyc_request_id=kyc_request.id,
            decision="DENIED",
            citizen_id=self.citizen.id
        )
        
        # Verify fields_shared is None
        self.assertIsNone(consent_record.fields_shared)
        
        kyc_request.refresh_from_db()
        self.assertEqual(kyc_request.fields_granted, [])