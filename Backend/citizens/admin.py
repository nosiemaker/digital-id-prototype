from django.contrib import admin
from .models import Citizen, Province, District

@admin.register(Province)
class ProvinceAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'created_at')
    search_fields = ('name', 'code')
    list_filter = ('is_active',)

@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'province', 'is_active', 'created_at')
    list_filter = ('province', 'is_active')
    search_fields = ('name', 'code')

@admin.register(Citizen)
class CitizenAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'din', 'nrc', 'status', 'district', 'created_at')
    list_filter = ('status', 'gender', 'district', 'citizen_type')
    search_fields = ('full_name', 'din', 'nrc', 'phone')
    readonly_fields = ('created_at', 'updated_at')
