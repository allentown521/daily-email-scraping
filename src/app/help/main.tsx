import React from "react";
import ReactDOM from "react-dom/client";

import clearEmailList from "~/assets/clear-email-list.png";
import openEmailList from "~/assets/download-email-list.png";
import { Layout } from "~/components/layout/layout";

const Help = () => {
  const steps = [
    {
      number: 1,
      title: "Open Email Scraper Extension",
      description:
        "Click the Email Scraper icon to open the main scraping interface",
      details: (
        <p>
          The extension is built-in and ready to use. No additional extensions
          are needed.
        </p>
      ),
      image: null,
    },
    {
      number: 2,
      title: "Select Website and Frequency",
      description: "Choose 'Daily' or 'Weekly' or any supported website",
      details: (
        <ul className="list-disc list-inside space-y-1">
          <li>
            For 'Daily' websites: Execute after UTC 08:00 to scrape previous
            day's data
          </li>
          <li>
            For 'Weekly' websites: Execute on Sunday to scrape this week's data
          </li>
          <li>Select one or multiple websites to scrape simultaneously</li>
        </ul>
      ),
      image: null,
    },
    {
      number: 3,
      title: "Automatic Scraping Process",
      description:
        "The extension will automatically scrape emails from selected websites",
      details: (
        <ul className="list-disc list-inside space-y-1">
          <li>All product pages will be opened automatically</li>
          <li>
            For Product Hunt and Peerlist: Pages will auto-scroll to load all
            products
          </li>
          <li>Emails are extracted from each product page automatically</li>
          <li>Pages will close automatically after scraping is complete</li>
          <li>
            Keep browser in foreground during scraping (scraping pauses in
            background)
          </li>
        </ul>
      ),
      image: null,
    },
    {
      number: 4,
      title: "View and Manage Collected Emails",
      description:
        "See the collected emails in the statistics panel and manage them",
      details: (
        <ul className="list-disc list-inside space-y-1">
          <li>Real-time counter shows total emails collected</li>
          <li>View email sources (mailto links, contact pages, etc.)</li>
          <li>Emails are automatically deduplicated</li>
        </ul>
      ),
      image: {
        open: openEmailList,
        clear: clearEmailList,
      },
    },
    {
      number: 5,
      title: "Download Email Data",
      description: "Export collected emails as a CSV file for further use",
      details: (
        <ul className="list-disc list-inside space-y-1">
          <li>Click 'Download CSV' button in the statistics panel</li>
          <li>File includes email, source URL, and timestamp</li>
          <li>File is named with current date (e.g., 6-4-emails.csv)</li>
        </ul>
      ),
      image: null,
    },
    {
      number: 6,
      title: "Clear History (Optional)",
      description:
        "Clear the saved email list before starting a new scraping session",
      details: (
        <ul className="list-disc list-inside space-y-1">
          <li>Click 'Clear All' button to delete all collected emails</li>
          <li>This action cannot be undone, so make sure to export first</li>
          <li>Recommended before each new scraping session</li>
        </ul>
      ),
      image: null,
    },
  ];

  return (
    <Layout>
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Email Scraping Guide
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Follow these steps to scrape emails from product launch websites
          </p>
        </div>

        <div className="space-y-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {step.number}
                  </div>
                </div>
                <div className="flex-grow">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {step.title}
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">
                    {step.description}
                  </p>

                  {step.details && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                      {typeof step.details === "string" ? (
                        <p>{step.details}</p>
                      ) : (
                        step.details
                      )}
                    </div>
                  )}

                  {step.image && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {step.image.open && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Download Email List:
                          </p>
                          <img
                            src={step.image.open}
                            alt="Open email list"
                            className="w-full h-auto rounded border border-gray-300 dark:border-gray-600"
                          />
                        </div>
                      )}
                      {step.image.clear && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Clear Email List:
                          </p>
                          <img
                            src={step.image.clear}
                            alt="Clear email list"
                            className="w-full h-auto rounded border border-gray-300 dark:border-gray-600"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Key Features
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
            <li>
              Multi-level email extraction: Direct pages → Contact pages → Team
              pages
            </li>
            <li>Automatic duplicate detection and removal</li>
            <li>Supports multiple email formats and obfuscated emails</li>
            <li>Filters test domains (@example.com, @test.com, etc.)</li>
            <li>One-click CSV export with email source tracking</li>
          </ul>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Important Notes
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
            <li>
              The extension automatically opens browser tabs for scraping, so
              use a dedicated browser instance to avoid disrupting normal work
            </li>
            <li>
              Keep your browser in foreground during the scraping process
              (scraping pauses when browser is in background)
            </li>
            <li>
              Clear existing email list before starting a new scraping session
              to avoid duplicates
            </li>
            <li>
              For daily websites, wait until after UTC 08:00 for best results
            </li>
            <li>
              For weekly websites, run on Sunday to get the complete week's data
            </li>
            <li>
              Email data is stored locally in your browser and can be exported
              at any time
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Help />
  </React.StrictMode>,
);
