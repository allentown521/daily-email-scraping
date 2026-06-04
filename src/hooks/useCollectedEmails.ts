import { useCallback } from "react";
import { StorageKey, useStorage } from "~/lib/storage";

export const useCollectedEmails = () => {
  const {
    data: emails,
    set: setEmails,
    remove,
  } = useStorage(StorageKey.COLLECTED_EMAILS);

  const emailCount = emails?.length || 0;

  const downloadCSV = useCallback(() => {
    if (!emails || emails.length === 0) {
      alert("No emails to download");
      return;
    }

    // Create CSV content
    const headers = ["email", "url", "time"];
    const rows = emails.map((email) => [
      email.email,
      email.foundOn,
      new Date(email.timestamp).toISOString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(cell).replace(/"/g, '""');
            return escaped.includes(",") || escaped.includes('"')
              ? `"${escaped}"`
              : escaped;
          })
          .join(","),
      ),
    ].join("\n");

    // Generate filename with current date
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const filename = `${month}-${day}-daily-email-scraping.csv`;

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [emails]);

  const clearAllEmails = useCallback(() => {
    if (!emails || emails.length === 0) {
      alert("No emails to clear");
      return;
    }

    if (
      confirm(
        `Are you sure you want to delete all ${emails.length} collected emails?`,
      )
    ) {
      setEmails([]);
    }
  }, [emails, setEmails]);

  return {
    emails: emails || [],
    emailCount,
    downloadCSV,
    clearAllEmails,
  };
};
