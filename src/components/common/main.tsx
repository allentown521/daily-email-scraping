import { BuyTypeEnum } from "@/service/lemonsqueezy";
import {
  activatePremium,
  deactivatePremium,
  validatePremiumOnline,
} from "@/service/premium";
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { cn } from "~/lib/utils";
import { Button } from "../ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";

interface MainProps {
  readonly className?: string;
  readonly filename: string;
}

interface SiteOption {
  id: string;
  name: string;
  url: string | ((date: Date) => string);
}

export const Main = ({ className, filename }: MainProps) => {
  const [selectedSites, setSelectedSites] = useState<Record<string, boolean>>({
    productHunt: false,
    startupfast: false,
    uneed: false,
    fazier: false,
    openLaunch: false,
    firsto: false,
    peerlist: false,
    tinylaunch: false,
    openhunts: false,
    auraplusplus: false,
    launchitx: false,
  });

  const [groupSelection, setGroupSelection] = useState<Record<string, boolean>>(
    {
      weekly: false,
      daily: false,
    }
  );

  const [hasPurchased, setHasPurchased] = useState(false); // 新增购买状态
  const [licenseError, setLicenseError] = useState("");
  const [licenseType, setLicenseType] = useState(null);
  const [activateError, setActivateError] = useState("");
  const [isLoadingValidatePremiumOnline, setIsLoadingValidatePremiumOnline] =
    useState(true);
  const handleGroupCheckboxChange = (group: string) => {
    const newGroupSelection = {
      ...groupSelection,
      [group]: !groupSelection[group],
    };
    setGroupSelection(newGroupSelection);

    if (group === "weekly") {
      setSelectedSites((prev) => ({
        ...prev,
        peerlist: newGroupSelection.weekly,
        tinylaunch: newGroupSelection.weekly,
      }));
    } else if (group === "daily") {
      setSelectedSites((prev) => ({
        ...prev,
        productHunt: newGroupSelection.daily,
        startupfast: newGroupSelection.daily,
        uneed: newGroupSelection.daily,
        fazier: newGroupSelection.daily,
        openLaunch: newGroupSelection.daily,
        firsto: newGroupSelection.daily,
        auraplusplus: newGroupSelection.daily,
        openhunts: newGroupSelection.daily,
        launchitx: newGroupSelection.daily,
      }));
    }
  };

  const siteOptions: SiteOption[] = [
    {
      id: "productHunt",
      name: "product hunt",
      url: (date: Date) => {
        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);

        const year = yesterday.getFullYear();
        const month = yesterday.getMonth() + 1; // getMonth() returns 0-11
        const day = yesterday.getDate();

        return `https://www.producthunt.com/leaderboard/daily/${year}/${month}/${day}/all`;
      },
    },
    {
      id: "startupfast",
      name: "startupfa.st",
      url: "https://www.startupfa.st/trending?filter=today",
    },
    {
      id: "uneed",
      name: "uneed",
      url: "https://www.uneed.best/",
    },
    {
      id: "fazier",
      name: "fazier",
      url: (date: Date) => {
        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate());

        const year = yesterday.getFullYear();
        const month = yesterday.getMonth() + 1; // getMonth() returns 0-11
        const day = yesterday.getDate();

        return `https://fazier.com/leaderboard/daily/${year}/${month}/${day}`;
      },
    },
    {
      id: "openLaunch",
      name: "open-launch",
      url: "https://open-launch.com/trending?filter=today",
    },
    {
      id: "firsto",
      name: "firsto",
      url: "https://firsto.co/trending?filter=today",
    },
    {
      id: "peerlist",
      name: "peerlist",
      url: (date: Date) => {
        const year = date.getFullYear();

        // Calculate which week of the year it is
        const firstDayOfYear = new Date(year, 0, 1);
        const pastDaysOfYear =
          (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        const week = Math.ceil(
          (pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7
        );

        return `https://peerlist.io/launchpad/${year}/week/${week}`;
      },
    },
    {
      id: "tinylaunch",
      name: "tinylaunch",
      url: "https://www.tinylaunch.com/",
    },
    {
      id: "auraplusplus",
      name: "auraplusplus",
      url: "https://auraplusplus.com/trending?filter=today",
    },
    {
      id: "openhunts",
      name: "openhunts",
      url: "https://openhunts.com/trending?filter=today",
    },
    {
      id: "launchitx",
      name: "launchitx",
      url: "https://launchitx.com/trending?filter=today",
    },
  ];

  const handleCheckboxChange = (id: string) => {
    setSelectedSites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  useEffect(() => {
    const fetchPremium = async () => {
      const { activated, error, type } = await validatePremiumOnline();
      setHasPurchased(activated);
      setLicenseError(error);
      setLicenseType(type);

      setIsLoadingValidatePremiumOnline(false);
    };

    fetchPremium();
  }, []);

  const handleStartScraping = () => {
    // 检查是否是会员
    if (!hasPurchased) {
      alert("Please purchase a premium license to use this feature.");
      return;
    }

    const today = new Date();

    siteOptions.forEach((site) => {
      if (selectedSites[site.id]) {
        const url = typeof site.url === "function" ? site.url(today) : site.url;
        browser.tabs.create({ url });
      }
    });
  };

  async function activateLicense() {
    const key = prompt(
      "Please enter your license key from your Lemonsqueezy order email"
    );
    if (key) {
      setActivateError("");
      activatePremium(key)
        .then((data) => {
          setHasPurchased(true);
          setLicenseType(data.type);
          setLicenseError("");
        })
        .catch((err) => {
          console.log(err);
          setActivateError(err.data?.error || err.message);
        });
    }
  }

  async function deactivateLicense() {
    confirm("Are you sure you want to deactivate your license?") &&
      deactivatePremium()
        .then(() => {
          setHasPurchased(false);
          setLicenseType(null);
          setLicenseError("");
        })
        .catch((err) => {
          setActivateError(err.data?.error || err.message);
        });
  }
  return (
    <main
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-6",
        className
      )}
    >
      <div className="w-full max-w-md">
        <h2 className="mb-4 text-center text-xl font-bold">
          Select websites to scrape
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="daily"
              checked={groupSelection.daily}
              onChange={() => handleGroupCheckboxChange("daily")}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="daily" className="text-sm font-medium">
              Daily
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="weekly"
              checked={groupSelection.weekly}
              onChange={() => handleGroupCheckboxChange("weekly")}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="weekly" className="text-sm font-medium">
              Weekly
            </label>
          </div>

          {siteOptions.map((site) => (
            <div key={site.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={site.id}
                checked={selectedSites[site.id]}
                onChange={() => handleCheckboxChange(site.id)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor={site.id} className="text-sm font-medium">
                {site.name}
              </label>
            </div>
          ))}
        </div>
        <Button
          onClick={handleStartScraping}
          disabled={!hasPurchased}
          className={cn(
            "mt-6 w-full rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            hasPurchased
              ? "cursor-pointer bg-primary text-white hover:bg-primary/90"
              : "cursor-not-allowed bg-gray-300 text-gray-500"
          )}
        >
          {hasPurchased ? "Start Scraping" : "🔒 Premium Required"}
        </Button>
        <div id="purchase" className="my-8">
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              🚀 Unlock Premium Features
            </h2>
            <p className="text-gray-600">
              Get unlimited access to all scraping features
            </p>
          </div>

          <div className="subscription-cards-container mb-6">
            {[
              {
                title: "Lifetime Purchase",
                price: "$19.9",
                period: "one-time payment",
                licenseType: BuyTypeEnum.ONETIME,
                devices: 10,
                purchaseUrl:
                  "https://marinara.lemonsqueezy.com/buy/ebe3b512-fb90-4ae4-8a04-7f1962a5b5cf",
                features: [
                  "Unlimited usage",
                  "Up to 10 devices",
                  "Lifetime updates",
                ],
              },
            ].map((card, index) => (
              <Card
                className={cn(
                  "relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105",
                  hasPurchased && card.licenseType === licenseType
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white"
                )}
                key={index}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-gray-900">
                      {card.title}
                    </CardTitle>
                    {hasPurchased && card.licenseType === licenseType && (
                      <div className="flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                        ✓ Active
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {card.price}
                    </span>
                    <span className="text-gray-600">/{card.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <ul className="space-y-2">
                    {card.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-center text-sm text-gray-700"
                      >
                        <svg
                          className="mr-2 h-4 w-4 text-green-500"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {!hasPurchased || card.licenseType !== licenseType ? (
                    <a
                      href={card.purchaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full"
                    >
                      <Button
                        className="w-full cursor-pointer bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-semibold"
                        size="lg"
                      >
                        Purchase Now
                      </Button>
                    </a>
                  ) : (
                    <div className="w-full space-y-3">
                      {licenseError ? (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                          {licenseError}
                        </div>
                      ) : (
                        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 font-medium">
                          ✨ License successfully activated
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full cursor-pointer border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={deactivateLicense}
                      >
                        Deactivate License
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            {hasPurchased ? (
              <div className="text-center">
                <a
                  href="https://app.lemonsqueezy.com/my-orders/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex"
                >
                  <Button
                    variant="outline"
                    className="cursor-pointer border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  >
                    📋 Manage Order & Devices
                  </Button>
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center">
                  <Button
                    variant="secondary"
                    className="w-full cursor-pointer"
                    onClick={activateLicense}
                  >
                    🔑 Activate License
                  </Button>
                </div>
                {activateError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 text-center">
                    ⚠️ {activateError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
