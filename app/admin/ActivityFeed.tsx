import { listRecentActivity } from "@/lib/firestore";
import { Bell, Mail, FileText, ArrowRightLeft } from "lucide-react";

const iconMap = {
  LEAD_RECEIVED: <Bell className="w-4 h-4 text-yellow-500" />,
  STATUS_CHANGED: <ArrowRightLeft className="w-4 h-4 text-blue-500" />,
  EMAIL_SENT: <Mail className="w-4 h-4 text-green-500" />,
  NOTE_ADDED: <FileText className="w-4 h-4 text-purple-500" />,
};

export async function ActivityFeed() {
  const activities = await listRecentActivity(8);

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Bell className="w-4 h-4 text-gray-400" /> Recent Activity
      </h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-3 items-start">
            <div className="mt-0.5 bg-gray-50 p-1.5 rounded-full border border-gray-100">
              {iconMap[activity.action]}
            </div>
            <div>
              <p className="text-sm text-gray-800">{activity.message}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(activity.timestamp.toMillis()).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No recent activity.</p>
        )}
      </div>
    </div>
  );
}