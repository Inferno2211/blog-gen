import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getOrderStatus,
  regenerateBacklink,
  customerSubmitForReview,
  customerSubmitArticleForReview,
  cancelScheduledPublication,
  reschedulePublication,
} from "../services/purchaseService";
import type { OrderStatusResponse } from "../types/purchase";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import BlogLayout from "../components/BlogLayout";
import { parseMarkdownWithFrontmatter } from "../utils/markdownParser";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Countdown Timer Component
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();

      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }

      return null;
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) {
    return (
      <p className="text-center text-green-600 font-semibold">
        🎉 Publish time reached! Article will be published shortly.
      </p>
    );
  }

  return (
    <div className="flex justify-center gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{timeLeft.days}</div>
        <div className="text-xs text-gray-600">Days</div>
      </div>
      <div className="text-2xl font-bold text-blue-600">:</div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{timeLeft.hours}</div>
        <div className="text-xs text-gray-600">Hours</div>
      </div>
      <div className="text-2xl font-bold text-blue-600">:</div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">
          {timeLeft.minutes}
        </div>
        <div className="text-xs text-gray-600">Minutes</div>
      </div>
      <div className="text-2xl font-bold text-blue-600">:</div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">
          {timeLeft.seconds}
        </div>
        <div className="text-xs text-gray-600">Seconds</div>
      </div>
    </div>
  );
}

export default function OrderStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("order_id");

  const [orderData, setOrderData] = useState<OrderStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Scheduling state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newScheduledDate, setNewScheduledDate] = useState<Date | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Schedule with submission
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

  // Fetch order status
  const fetchOrderStatus = async () => {
    if (!orderId) {
      setError("No order ID provided");
      setLoading(false);
      return null;
    }

    try {
      const response = await getOrderStatus(orderId);

      // Backend returns { success, message, data: { status, orderDetails, version, queue, ... } }
      // We need to transform it to match our OrderStatusResponse interface
      const transformedData: OrderStatusResponse = {
        order: {
          id: response.data.orderDetails.orderId,
          article_id: response.data.orderDetails.articleId,
          version_id: response.data.version?.versionId || undefined,
          customer_email: response.data.orderDetails.customerEmail,
          backlink_data: response.data.orderDetails.backlinkData,
          status: response.data.status as any,
          created_at: response.data.orderDetails.createdAt,
          completed_at: response.data.orderDetails.completedAt,
          scheduled_publish_at: response.data.orderDetails.scheduledPublishAt,
          scheduled_status: response.data.orderDetails.scheduledStatus as any,
          session_id: "", // Not needed in UI
          payment_data: {} as any, // Not needed in UI
        },
        progress: {
          status: response.data.status,
          message: response.data.statusMessage,
          currentStage: response.data.status,
          stages: [
            {
              name: "Order Received",
              status: "completed",
              timestamp: response.data.orderDetails.createdAt,
            },
            {
              name: "Processing",
              status:
                response.data.status === "PROCESSING"
                  ? "in-progress"
                  : ["QUALITY_CHECK", "ADMIN_REVIEW", "COMPLETED"].includes(
                      response.data.status
                    )
                  ? "completed"
                  : "pending",
            },
            {
              name: "Quality Check",
              status:
                response.data.status === "QUALITY_CHECK"
                  ? "in-progress"
                  : ["ADMIN_REVIEW", "COMPLETED"].includes(response.data.status)
                  ? "completed"
                  : "pending",
            },
            {
              name: "Admin Review",
              status:
                response.data.status === "ADMIN_REVIEW"
                  ? "in-progress"
                  : response.data.status === "COMPLETED"
                  ? "completed"
                  : "pending",
            },
            {
              name: "Completed",
              status:
                response.data.status === "COMPLETED" ? "completed" : "pending",
              timestamp: response.data.orderDetails.completedAt,
            },
          ],
        },
        queueStatus: response.data.queue?.hasActiveJob
          ? {
              queue: response.data.queue.jobs?.[0]?.queue || "processing",
              state: response.data.queue.jobs?.[0]?.state || "unknown",
              progress: response.data.queue.jobs?.[0]?.progress,
              timestamp: new Date().toISOString(),
            }
          : undefined,
        content: response.data.version
          ? {
              contentMd: response.data.version.content,
              title: response.data.orderDetails.articleSlug || "Your Article",
              preview: response.data.version.content?.substring(0, 500),
            }
          : undefined,
        regenerationCount: 0, // TODO: Add to backend response
      };

      setOrderData(transformedData);
      setError("");

      // Return the transformed data so caller can check status
      return transformedData;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load order status"
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Separate useEffect for polling management
  useEffect(() => {
    if (!orderId) return;

    // Initial fetch
    fetchOrderStatus();

    // Set up polling interval
    const interval = setInterval(async () => {
      const data = await fetchOrderStatus();

      // Stop polling if status is no longer PROCESSING
      if (data && data.order.status !== "PROCESSING") {
        clearInterval(interval);
      }
    }, 5000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
    };
  }, [orderId]);

  // Handle regenerate (works for both article generation and backlink integration)
  const handleRegenerate = async () => {
    if (!orderId) return;

    setRegenerating(true);
    setError("");

    try {
      // The backend regenerateBacklink endpoint handles both article and backlink orders
      // It uses the queue system and sends email notifications on completion
      await regenerateBacklink(orderId);

      // Immediately fetch updated status - order should now be in PROCESSING
      // The useEffect polling will continue until status changes to QUALITY_CHECK
      await fetchOrderStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate content"
      );
    } finally {
      setRegenerating(false);
    }
  };

  // Handle submit for review
  const handleSubmitForReview = async () => {
    if (!orderId || !orderData?.order.version_id) return;

    setSubmitting(true);
    setError("");

    try {
      const isArticleOrder = (() => {
        const bd = order?.backlink_data as any;
        if (!bd || typeof bd !== "object") return false;
        if (!bd.type) return false;
        return String(bd.type).toUpperCase() === "ARTICLE_GENERATION";
      })();

      const submitData: any = {
        orderId,
        versionId: orderData.order.version_id,
      };

      // Include schedule if enabled
      if (scheduleEnabled && scheduledDate) {
        submitData.scheduledPublishAt = scheduledDate.toISOString();
      }

      if (isArticleOrder) {
        await customerSubmitArticleForReview(submitData);
      } else {
        await customerSubmitForReview(submitData);
      }

      if (scheduleEnabled && scheduledDate) {
        alert(
          `Article submitted for admin review and scheduled for publish at ${scheduledDate.toLocaleString()}`
        );
      }

      navigate("/review-submitted");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit for review"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel scheduled publish
  const handleCancelSchedule = async () => {
    if (!orderId || !orderData?.order.version_id) return;

    if (
      !confirm(
        "Are you sure you want to cancel the scheduled publication? You can reschedule later."
      )
    ) {
      return;
    }

    setCancelling(true);
    setError("");

    try {
      await cancelScheduledPublication({
        orderId,
        versionId: orderData.order.version_id,
      });
      await fetchOrderStatus(); // Refresh to show updated status
      alert("Scheduled publication cancelled successfully");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel schedule"
      );
    } finally {
      setCancelling(false);
    }
  };

  // Handle reschedule
  const handleReschedule = async () => {
    if (!orderId || !orderData?.order.version_id || !newScheduledDate) return;

    setRescheduling(true);
    setError("");

    try {
      await reschedulePublication({
        orderId,
        versionId: orderData.order.version_id,
        scheduledPublishAt: newScheduledDate,
      });
      await fetchOrderStatus(); // Refresh to show updated time
      setShowRescheduleModal(false);
      setNewScheduledDate(null);
      alert(
        `Article rescheduled for publish at ${newScheduledDate.toLocaleString()}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Invalid Order
          </h1>
          <p className="text-gray-600 mb-4">No order ID was provided.</p>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (error && !orderData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <ErrorMessage message={error} />
          <button
            onClick={() => navigate("/")}
            className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (!orderData) return null;

  const { order, progress, queueStatus, content, regenerationCount } =
    orderData;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Order Status
          </h1>
          <p className="text-gray-600">Order ID: {orderId}</p>
          <p className="text-sm text-gray-500 mt-1">
            Email: {order.customer_email}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} />
          </div>
        )}

        {/* Progress Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Order Progress
          </h2>

          {/* Status Badge */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-block px-4 py-2 rounded-full font-semibold text-sm ${
                order.status === "COMPLETED"
                  ? "bg-green-100 text-green-800"
                  : order.status === "FAILED"
                  ? "bg-red-100 text-red-800"
                  : order.status === "ADMIN_REVIEW"
                  ? "bg-purple-100 text-purple-800"
                  : order.status === "QUALITY_CHECK"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {order.status.replace(/_/g, " ")}
            </span>
            {regenerationCount !== undefined && regenerationCount > 0 && (
              <span className="text-sm text-gray-600">
                Regenerated {regenerationCount} time
                {regenerationCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Progress Message */}
          <p className="text-gray-700 mb-4">{progress.message}</p>

          {/* Queue Status (when processing) */}
          {queueStatus && order.status === "PROCESSING" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="font-semibold text-blue-800">
                  Processing in Queue: {queueStatus.queue}
                </span>
              </div>
              <p className="text-sm text-blue-700">
                State: {queueStatus.state}
              </p>
              {queueStatus.progress !== undefined && (
                <div className="mt-2">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${queueStatus.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    {queueStatus.progress}% complete
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Progress Stages */}
          <div className="space-y-3">
            {progress.stages.map((stage, index) => (
              <div key={index} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    stage.status === "completed"
                      ? "bg-green-500 text-white"
                      : stage.status === "in-progress"
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {stage.status === "completed" ? (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : stage.status === "in-progress" ? (
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  ) : (
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      stage.status === "completed"
                        ? "text-gray-800"
                        : stage.status === "in-progress"
                        ? "text-blue-600"
                        : "text-gray-500"
                    }`}
                  >
                    {stage.name}
                  </p>
                  {stage.timestamp && (
                    <p className="text-xs text-gray-500">
                      {new Date(stage.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scheduled Publication Section */}
        {order.scheduled_publish_at &&
          order.scheduled_status === "SCHEDULED" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">
                ⏰ Scheduled for Publication
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-blue-700">
                    <strong>Publish Date:</strong>{" "}
                    {new Date(order.scheduled_publish_at).toLocaleString()}
                  </p>
                </div>

                {/* Countdown Timer */}
                <div className="bg-white border border-blue-200 rounded-lg p-4">
                  <CountdownTimer targetDate={order.scheduled_publish_at} />
                </div>

                {/* Management Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleCancelSchedule}
                    disabled={cancelling}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {cancelling ? "Cancelling..." : "❌ Cancel Schedule"}
                  </button>
                  <button
                    onClick={() => {
                      setNewScheduledDate(
                        new Date(order.scheduled_publish_at!)
                      );
                      setShowRescheduleModal(true);
                    }}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    📅 Reschedule
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Schedule Status Badges */}
        {order.scheduled_status && order.scheduled_status !== "SCHEDULED" && (
          <div
            className={`rounded-lg p-4 mb-6 ${
              order.scheduled_status === "PUBLISHED"
                ? "bg-green-50 border border-green-200"
                : order.scheduled_status === "CANCELLED"
                ? "bg-gray-50 border border-gray-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <p
              className={`font-semibold ${
                order.scheduled_status === "PUBLISHED"
                  ? "text-green-800"
                  : order.scheduled_status === "CANCELLED"
                  ? "text-gray-800"
                  : "text-red-800"
              }`}
            >
              {order.scheduled_status === "PUBLISHED" &&
                "✅ Published on schedule"}
              {order.scheduled_status === "CANCELLED" &&
                "⚠️ Schedule cancelled"}
              {order.scheduled_status === "FAILED" &&
                "❌ Scheduled publish failed"}
            </p>
            {order.scheduled_publish_at && (
              <p
                className={`text-sm mt-1 ${
                  order.scheduled_status === "PUBLISHED"
                    ? "text-green-700"
                    : order.scheduled_status === "CANCELLED"
                    ? "text-gray-700"
                    : "text-red-700"
                }`}
              >
                {order.scheduled_status === "PUBLISHED" && "Published at: "}
                {order.scheduled_status === "CANCELLED" &&
                  "Was scheduled for: "}
                {order.scheduled_status === "FAILED" &&
                  "Failed to publish at: "}
                {new Date(order.scheduled_publish_at).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Reschedule Publication
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Publish Date & Time
                </label>
                <DatePicker
                  selected={newScheduledDate}
                  onChange={(date: Date | null) => setNewScheduledDate(date)}
                  showTimeSelect
                  timeIntervals={1}
                  timeCaption="Time"
                  dateFormat="PPpp"
                  minDate={new Date()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholderText="Select new date and time"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Time shown in your local timezone
                </p>
              </div>

              {/* Preset Buttons */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    const date = new Date();
                    date.setMonth(date.getMonth() + 1);
                    setNewScheduledDate(date);
                  }}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
                >
                  1 Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const date = new Date();
                    date.setMonth(date.getMonth() + 2);
                    setNewScheduledDate(date);
                  }}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
                >
                  2 Months
                </button>
              </div>

              {newScheduledDate && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>New schedule:</strong>{" "}
                    {newScheduledDate.toLocaleString()}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setNewScheduledDate(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!newScheduledDate || rescheduling}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {rescheduling ? "Rescheduling..." : "Confirm Reschedule"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Article Content Preview (when in QUALITY_CHECK) */}
        {order.status === "QUALITY_CHECK" && content && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Your Article Preview
            </h2>

            {/* Full Article Preview using BlogLayout */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
              <BlogLayout
                frontmatter={
                  parseMarkdownWithFrontmatter(content.contentMd).frontmatter
                }
                content={
                  parseMarkdownWithFrontmatter(content.contentMd).content
                }
              />
            </div>

            {/* Scheduling Section */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="schedule-publish"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="schedule-publish"
                  className="text-sm font-medium text-gray-700"
                >
                  📅 Schedule publication for later
                </label>
              </div>

              {scheduleEnabled && (
                <div className="ml-6 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Publish Date & Time
                    </label>
                    <DatePicker
                      selected={scheduledDate}
                      onChange={(date: Date | null) => setScheduledDate(date)}
                      showTimeSelect
                      timeIntervals={1}
                      timeCaption="Time"
                      dateFormat="PPpp"
                      minDate={new Date()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholderText="Select date and time"
                      required={scheduleEnabled}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Time shown in your local timezone
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const date = new Date();
                        date.setMonth(date.getMonth() + 1);
                        setScheduledDate(date);
                      }}
                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
                    >
                      1 Month
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const date = new Date();
                        date.setMonth(date.getMonth() + 2);
                        setScheduledDate(date);
                      }}
                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
                    >
                      2 Months
                    </button>
                  </div>

                  {scheduledDate && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Scheduled for:</strong>{" "}
                        {scheduledDate.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {regenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Regenerating...
                  </span>
                ) : (
                  (() => {
                    const bd = order?.backlink_data as any;
                    const isArticleOrder =
                      bd?.type?.toUpperCase() === "ARTICLE_GENERATION";
                    return isArticleOrder
                      ? "🔄 Regenerate Article"
                      : "🔄 Regenerate Backlink Integration";
                  })()
                )}
              </button>

              <button
                onClick={handleSubmitForReview}
                disabled={submitting}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Submitting...
                  </span>
                ) : (
                  "✓ Submit for Admin Review"
                )}
              </button>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> You can regenerate the backlink
                integration as many times as you'd like. Each regeneration uses
                the published article as the base and integrates your backlink
                naturally. When you're satisfied, submit for admin review.
              </p>
            </div>
          </div>
        )}

        {/* Admin Review Notice */}
        {order.status === "ADMIN_REVIEW" && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-purple-800 mb-2">
              Under Admin Review
            </h3>
            <p className="text-purple-700">
              Your article has been submitted for admin review. You'll receive
              an email notification once it's approved and published.
            </p>
          </div>
        )}

        {/* Completed Notice */}
        {order.status === "COMPLETED" && !order.scheduled_publish_at && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              🎉 Order Completed!
            </h3>
            <p className="text-green-700 mb-4">
              Your article has been approved and published. You should have
              received a confirmation email with the live article URL.
            </p>
            {order.completed_at && (
              <p className="text-sm text-green-600">
                Completed on: {new Date(order.completed_at).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Approved but Scheduled Notice */}
        {order.status === "COMPLETED" &&
          order.scheduled_publish_at &&
          order.scheduled_status === "SCHEDULED" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                ✅ Approved - Scheduled for Publication
              </h3>
              <p className="text-blue-700 mb-4">
                Great news! Your article has been reviewed and approved by our
                admin team. It will be automatically published at your scheduled
                time.
              </p>
              <div className="bg-white border border-blue-200 rounded-lg p-4 mb-3">
                <p className="text-blue-800 font-semibold mb-2">
                  📅 Scheduled Publish Time:{" "}
                  {new Date(order.scheduled_publish_at).toLocaleString()}
                </p>
                <CountdownTimer targetDate={order.scheduled_publish_at} />
              </div>
              <p className="text-sm text-blue-600">
                Approved on:{" "}
                {order.completed_at
                  ? new Date(order.completed_at).toLocaleString()
                  : "Just now"}
              </p>
            </div>
          )}

        {/* Failed Notice */}
        {order.status === "FAILED" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Order Failed
            </h3>
            <p className="text-red-700">
              Unfortunately, there was an issue with your order. Please contact
              support for assistance.
            </p>
          </div>
        )}

        {/* Backlink Details / Order Details */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {(() => {
            const bd = order?.backlink_data as any;
            const isArticleOrder =
              bd?.type?.toUpperCase() === "ARTICLE_GENERATION";

            return (
              <>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  {isArticleOrder ? "Article Details" : "Backlink Details"}
                </h2>
                <div className="space-y-2">
                  {isArticleOrder ? (
                    <>
                      {/* Article Generation Order */}
                      <div>
                        <span className="font-medium text-gray-700">
                          Order Type:
                        </span>
                        <span className="ml-2 text-gray-600">
                          Article Generation
                        </span>
                      </div>
                      {bd.articleTitle && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Article Title:
                          </span>
                          <span className="ml-2 text-gray-600">
                            {bd.articleTitle}
                          </span>
                        </div>
                      )}
                      {bd.topic && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Topic:
                          </span>
                          <span className="ml-2 text-gray-600">{bd.topic}</span>
                        </div>
                      )}
                      {bd.niche && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Niche:
                          </span>
                          <span className="ml-2 text-gray-600">{bd.niche}</span>
                        </div>
                      )}
                      {bd.notes && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Notes:
                          </span>
                          <p className="mt-1 text-gray-600">{bd.notes}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Backlink Purchase Order */}
                      {order.backlink_data.target_url && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Target URL:
                          </span>
                          <a
                            href={order.backlink_data.target_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:underline break-all"
                          >
                            {order.backlink_data.target_url}
                          </a>
                        </div>
                      )}
                      {order.backlink_data.keyword && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Anchor Text:
                          </span>
                          <span className="ml-2 text-gray-600">
                            {order.backlink_data.keyword}
                          </span>
                        </div>
                      )}
                      {order.backlink_data.notes && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Notes:
                          </span>
                          <p className="mt-1 text-gray-600">
                            {order.backlink_data.notes}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
