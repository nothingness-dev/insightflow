from django.contrib import admin

from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'action', 'actor_username', 'status', 'is_critical', 'description')
    list_filter = ('action', 'status', 'is_critical', 'actor_role')
    search_fields = ('actor_username', 'actor_full_name', 'description', 'target_repr', 'ip_address')
    date_hierarchy = 'created_at'
    readonly_fields = [f.name for f in ActivityLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
