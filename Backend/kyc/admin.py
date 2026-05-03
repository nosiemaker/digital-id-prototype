from django.contrib import admin
from .models import KYCRequest,ConsentRecord,ThirdPartyInstitution

@admin.register(ThirdPartyInstitution)
class ThirdPartyInstitutionAdmin(admin.ModelAdmin):
    list_display = ('name', 'reg_number', 'institution_id', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'reg_number', 'institution_id', 'email')
    readonly_fields = ('created_at', 'updated_at')

admin.site.register(KYCRequest)
admin.site.register(ConsentRecord)
