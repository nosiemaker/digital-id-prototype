from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import SystemUser, UserRole


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