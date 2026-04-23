from django.contrib import admin
from .models import KYCRequest,ConsentRecord,ThirdPartyInstitution

admin.site.register(ThirdPartyInstitution)
admin.site.register(KYCRequest)
admin.site.register(ConsentRecord)
