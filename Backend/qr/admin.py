from django.contrib import admin

from .models import QRLog


@admin.register(QRLog)
class QRLogAdmin(admin.ModelAdmin):
    list_display = ["din", "event_type", "timestamp"]
    list_filter = ["event_type", "timestamp"]
    search_fields = ["din"]
    readonly_fields = ["din", "event_type", "timestamp", "details"]
    ordering = ["-timestamp"]

