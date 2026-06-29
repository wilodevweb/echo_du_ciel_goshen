import React, { useState, useEffect } from "react";
import { History } from "lucide-react";

interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  userFullName: string | null;
  action: string;
  details: string;
  createdAt: string;
}

export default function ActivitesTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/admin/logs");
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Erreur de chargement des logs d'activité", err);
    } finally {
      setLoadingLogs(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <History className="w-5 h-5 text-fiverr" />
          Historique des actions
        </span>
        <button 
          onClick={fetchLogs} 
          className="text-xs text-fiverr hover:underline font-semibold"
        >
          Rafraîchir
        </button>
      </h2>

      {loadingLogs ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-950 border border-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-gray-950 border border-gray-800 rounded-2xl text-gray-500">
          Aucun log d&apos;activité trouvé dans la base de données.
        </div>
      ) : (
        <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900 text-gray-400 font-semibold">
                  <th className="p-3 md:p-4">Date/Heure</th>
                  <th className="p-3 md:p-4">Moniteur</th>
                  <th className="p-3 md:p-4">Action</th>
                  <th className="p-3 md:p-4">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850">
                {logs.map((log) => {
                  let actionColor = "text-gray-300 bg-gray-800";
                  if (log.action === "CONNEXION") actionColor = "text-emerald-400 bg-emerald-950/40 border border-emerald-900/30";
                  if (log.action === "CREATE_USER") actionColor = "text-blue-400 bg-blue-950/40 border border-blue-900/30";
                  if (log.action === "BLOCK_USER") actionColor = "text-amber-400 bg-amber-950/40 border border-amber-900/30";
                  if (log.action === "DELETE_USER") actionColor = "text-red-400 bg-red-950/40 border border-red-900/30";
                  if (log.action === "UPLOAD_FILE") actionColor = "text-purple-400 bg-purple-950/40 border border-purple-900/30";
                  if (log.action === "SYNC_DATA") actionColor = "text-cyan-400 bg-cyan-950/40 border border-cyan-900/30";

                  return (
                    <tr key={log.id} className="hover:bg-gray-900/40 transition">
                      <td className="p-3 md:p-4 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="p-3 md:p-4 whitespace-nowrap">
                        <div className="font-bold text-gray-200">{log.userFullName || log.username || "Inconnu"}</div>
                        <div className="text-[10px] text-gray-500">@{log.username}</div>
                      </td>
                      <td className="p-3 md:p-4 whitespace-nowrap">
                        <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full ${actionColor}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 md:p-4 text-gray-400 min-w-[200px]">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
