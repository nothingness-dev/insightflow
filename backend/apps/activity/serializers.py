from rest_framework import serializers

from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(read_only=True)
    actor_display = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'action', 'action_label', 'actor', 'actor_username',
            'actor_full_name', 'actor_role', 'actor_display', 'description',
            'target_type', 'target_id', 'target_repr', 'status', 'is_critical',
            'ip_address', 'user_agent', 'metadata', 'created_at',
        ]
        read_only_fields = fields

    def get_actor_display(self, obj):
        if obj.actor_full_name and obj.actor_username:
            return f'{obj.actor_full_name} ({obj.actor_username})'
        return obj.actor_full_name or obj.actor_username or 'سیستم'
