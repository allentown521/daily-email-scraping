import React from "react";
import ReactDOM from "react-dom/client";

import clearEmailList from "~/assets/clear-email-list.png";
import openEmailList from "~/assets/open-email-list.png";
import { Layout } from "~/components/layout/layout";

const Help = () => {
  const steps = [
    {
      number: 1,
      title: "Install Email Finder Extension",
      description:
        "Install the Email Finder browser extension from Chrome Web Store",
      details: (
        <a
          href="https://chromewebstore.google.com/detail/email-finder-email-hunter/aihgkhchhecmambgbonicffgneidgclh"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Install Email Finder Extension
        </a>
      ),
      image: null,
    },
    {
      number: 2,
      title: "Manage Email List",
      description: "Click the Email Finder icon to open the scraped email list",
      details: (
        <p>Clear the saved email list before starting a new scraping session</p>
      ),
      image: {
        open: openEmailList,
        clear: clearEmailList,
      },
    },
    {
      number: 3,
      title: "Open Product Hunt Email Scrap",
      description:
        "Click the Product Hunt Email Scrap icon or open it from the sidebar",
      details: (
        <p>
          This will open the main interface for selecting websites to scrape
        </p>
      ),
      image: null,
    },
    {
      number: 4,
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
        </ul>
      ),
      image: null,
    },
    {
      number: 5,
      title: "Automatic Scraping Process",
      description:
        "The extension will automatically open selected websites and all product official pages",
      details: (
        <ul className="list-disc list-inside space-y-1">
          <li>All product pages will be opened automatically</li>
          <li>
            For Product Hunt and Peerlist: Pages will auto-scroll to the bottom
          </li>
          <li>
            Keep browser in foreground during scrolling (scrolling stops when
            browser is in background)
          </li>
          <li>Pages will close automatically after scraping is complete</li>
        </ul>
      ),
      image: null,
    },
    {
      number: 6,
      title: "Download Email Data",
      description:
        "After all pages are closed (except the main scraping website), download the data",
      details: (
        <ul className="list-disc list-inside space-y-1">
          <li>Click the Email Finder icon to open the scraped email list</li>
          <li>Download the emails as CSV file</li>
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
                            Open Email List:
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

        <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Important Notes
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
            <li>
              Extensions automatically open the web page until the crawl is
              complete, so you should always run the extension in a fixed
              browser instance to avoid affecting normal use.
            </li>
            <li>Keep your browser in foreground during the scraping process</li>
            <li>
              Clear existing email list before starting new scraping session
            </li>
            <li>
              For daily websites, wait until after UTC 08:00 for best results
            </li>
            <li>
              For weekly websites, run on Sunday to get the complete week's data
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
  </React.StrictMode>
);
