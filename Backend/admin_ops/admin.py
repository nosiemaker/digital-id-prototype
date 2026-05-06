from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from .models import SystemUser, UserRole, ThirdPartyEnrollmentRequest, UssdUser
from registration.models import EnrollmentStatus
from .services.user_management import approve_third_party_registration


@admin.register(SystemUser)
class SystemUserAdmin(UserAdmin):
    # 1. This controls the list view (what you see in the table)
    list_display = ('email', 'username', 'role', 'get_din', 'is_staff')

    # 2. This controls the "Edit User" page
    fieldsets = UserAdmin.fieldsets + (
        ('Project Identification', {'fields': ('role', 'institution_din')}),
    )

    # 3. This controls the "Add User" page (the one in your screenshot)
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Project Identification', {
            'classes': ('wide',),
            'fields': ('email', 'role', 'institution_din'),
        }),
    )

    @admin.display(description="DIN")
    def get_din(self, obj):
        if obj.role == UserRole.CITIZEN:
            return obj.profile.din if hasattr(obj, "profile") else "—"
        return obj.institution_din or "—"


@admin.register(ThirdPartyEnrollmentRequest)
class ThirdPartyEnrollmentRequestAdmin(admin.ModelAdmin):
    list_display = ('get_institution_name', 'status', 'submitted_at', 'reviewed_at')
    list_filter = ('status',)
    actions = ['approve_requests']

    @admin.display(description="Institution")
    def get_institution_name(self, obj):
        return obj.third_party_institution.name

    @admin.action(description="Approve selected enrollment requests")
    def approve_requests(self, request, queryset):
        success_count = 0
        for enrollment in queryset:
            if enrollment.status == EnrollmentStatus.PENDING:
                try:
                    # By default, we grant a basic scope. This can be customized.
                    basic_scope = ["full_name", "dob", "phone"]
                    approve_third_party_registration(
                        enrollment.id, 
                        request.user.id, 
                        basic_scope
                    )
                    success_count += 1
                except Exception as e:
                    self.message_user(
                        request, 
                        f"Error approving {enrollment.third_party_institution.name}: {str(e)}", 
                        level=messages.ERROR
                    )
        
        if success_count:
            self.message_user(
                request, 
                f"Successfully approved {success_count} requests and created accounts.", 
                level=messages.SUCCESS
            )


@admin.register(UssdUser)
class UssdUserAdmin(admin.ModelAdmin):
    list_display = ('phone', 'get_citizen_name', 'get_citizen_nrc', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('phone', 'citizen__full_name', 'citizen__nrc', 'citizen__din')
    readonly_fields = ('created_at', 'updated_at', 'password_hash')
    fieldsets = (
        ('Account Info', {
            'fields': ('phone', 'citizen', 'is_active')
        }),
        ('Security', {
            'fields': ('password_hash',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description="Citizen Name", ordering='citizen__full_name')
    def get_citizen_name(self, obj):
        return obj.citizen.full_name if obj.citizen else '—'

    @admin.display(description="NRC", ordering='citizen__nrc')
    def get_citizen_nrc(self, obj):
        return obj.citizen.nrc if obj.citizen else '—'