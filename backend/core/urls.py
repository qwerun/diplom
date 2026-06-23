from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityResultViewSet,
    ActivityMediaViewSet,
    ActivityViewSet,
    AnalyticsViewSet,
    CampaignViewSet,
    ChannelViewSet,
    MetricSourceViewSet,
    MetricTypeViewSet,
    MetricValueViewSet,
    MeView,
    ReportViewSet,
    StatusTransitionViewSet,
    StatusViewSet,
    UserViewSet,
)


router = DefaultRouter()
router.register("users", UserViewSet)
router.register("statuses", StatusViewSet)
router.register("status-transitions", StatusTransitionViewSet)
router.register("campaigns", CampaignViewSet)
router.register("channels", ChannelViewSet)
router.register("metric-sources", MetricSourceViewSet)
router.register("activities", ActivityViewSet)
router.register("activity-results", ActivityResultViewSet)
router.register("activity-media", ActivityMediaViewSet)
router.register("metric-types", MetricTypeViewSet)
router.register("metric-values", MetricValueViewSet)
router.register("reports", ReportViewSet)
router.register("analytics", AnalyticsViewSet, basename="analytics")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
] + router.urls
