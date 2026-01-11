import { BuyTypeEnum } from "@/service/lemonsqueezy";
import {
  activatePremium,
  deactivatePremium,
  validatePremiumOnline,
} from "@/service/premium";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { checkIsInTrial, cn, scraperEnabled } from "~/lib/utils";
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
  openInSingleBrowser?: boolean;
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
  const [trialInfo, setTrialInfo] = useState<{
    isTrial: boolean;
    daysLeft: number;
    hasStarted: boolean;
  }>({ isTrial: false, daysLeft: 0, hasStarted: false });

  const [fpHash, setFpHash] = useState("");
  const [isContentScriptEnabled, setIsContentScriptEnabled] = useState(true); // 总开关，默认打开
  const [showTooltip, setShowTooltip] = useState(false); // 控制tooltip显示
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
        nxgntools: newGroupSelection.weekly,
        // launchigniter: newGroupSelection.weekly,
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
        // peerpush: newGroupSelection.daily,
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

        // Calculate which week of the year it is using ISO 8601 standard
        const getISOWeek = (d: Date): number => {
          const target = new Date(d.valueOf());
          const dayNr = (d.getDay() + 6) % 7; // Make Monday = 0, Sunday = 6
          target.setDate(target.getDate() - dayNr + 3);
          const firstThursday = target.valueOf();
          target.setMonth(0, 1);
          if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
          }
          return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000
        };

        const week = getISOWeek(date);

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
    {
      id: "peerpush",
      name: "peerpush",
      openInSingleBrowser: true,

      url: "https://peerpush.net/?view=live",
    },
    {
      id: "nxgntools",
      name: "nxgntools",
      url: "https://www.nxgntools.com/launching",
    },
    /*     {
      id: "launchigniter",
      openInSingleBrowser: true,
      name: "launchigniter",
      url: "https://launchigniter.com/",
    }, */
  ];

  const handleCheckboxChange = (id: string) => {
    setSelectedSites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 处理总开关变化
  const handleContentScriptToggle = async () => {
    const newState = !isContentScriptEnabled;
    setIsContentScriptEnabled(newState);
    // 保存状态到浏览器存储
    await browser.storage.local.set({ contentScriptEnabled: newState });
  };

  // 生成设备指纹
  const generateDeviceFingerprint = async (): Promise<string> => {
    try {
      // 使用 FingerprintJS 生成更准确的设备指纹
      const fp = await FingerprintJS.load();
      const { visitorId } = await fp.get();
      return visitorId;
    } catch (error) {
      console.warn(
        "FingerprintJS failed, falling back to manual fingerprint:",
        error
      );

      // 降级到手动指纹生成
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillText("Device fingerprint", 2, 2);
      }

      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL(),
        // 添加更多浏览器特征
      ].join("|");

      // 简单哈希
      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // 转换为32位整数
      }
      return Math.abs(hash).toString(36);
    }
  };

  // 开始试用
  const startTrial = async () => {
    try {
      // 使用 FingerprintJS 的 visitorId 作为设备指纹
      let deviceFingerprint = fpHash;
      if (!deviceFingerprint) {
        // 如果 fpHash 还没准备好，手动生成
        deviceFingerprint = await generateDeviceFingerprint();
      }

      // 调用API检查试用资格
      const email = `${deviceFingerprint}@producthunt.scaper.com`;
      const response = await fetch(
        `https://api.focusapps.app/free-trial?email=${encodeURIComponent(
          email
        )}`
      );

      if (!response.ok) {
        if (response.status === 409) {
          // 如果返回是409，提示用户试用机会已用
          alert(
            "Trial opportunity has been used, please purchase a premium license"
          );
        } else {
          alert(
            "An error occurred while starting the trial, please try again later"
          );
        }

        return;
      }

      const result = await response.json();
      const contactId = result.id; // 获取返回的ID

      // 只存储contactId用于后续检查，不存储试用状态
      await browser.storage.local.set({
        deviceFingerprint,
        contactId,
      });

      // 试用开始后立即检查状态
      await checkTrialStatus();
    } catch (error) {
      console.error("Error starting trial:", error);
      alert(
        "An error occurred while starting the trial, please try again later"
      );
    }
  };

  // 检查试用状态
  const checkTrialStatus = async () => {
    const { isInTrial, daysLeft, hasStarted } = await checkIsInTrial();

    setTrialInfo({
      isTrial: isInTrial,
      daysLeft: daysLeft,
      hasStarted: hasStarted,
    });

    return isInTrial;
  };

  // create and set fingerprint as soon as component mounts
  useEffect(() => {
    const setFp = async () => {
      try {
        const fp = await FingerprintJS.load();
        const { visitorId } = await fp.get();
        setFpHash(visitorId);
      } catch (error) {
        console.warn("Failed to load FingerprintJS:", error);
      }
    };

    setFp();
  }, []);

  useEffect(() => {
    const fetchPremium = async () => {
      const { activated, error, type } = await validatePremiumOnline();
      setHasPurchased(activated);
      setLicenseError(error);
      setLicenseType(type);

      // 检查试用状态
      await checkTrialStatus();
      setIsLoadingValidatePremiumOnline(false);
    };

    fetchPremium();
  }, []);

  // 加载总开关状态
  useEffect(() => {
    const loadContentScriptState = async () => {
      const enabled = await scraperEnabled();
      setIsContentScriptEnabled(enabled);
    };

    loadContentScriptState();
  }, []);

  const handleStartScraping = () => {
    // 检查内容脚本总开关
    if (!isContentScriptEnabled) {
      alert(
        "Content scripts are disabled. Please enable the main switch first."
      );
      return;
    }

    // 检查是否是会员或在试用期内
    if (!hasPurchased && !trialInfo.isTrial) {
      alert("Please purchase a premium license to use this feature.");
      return;
    }

    if (trialInfo.isTrial && !hasPurchased) {
      alert(
        `🎯 Trial Mode: ${trialInfo.daysLeft} days remaining. Enjoy your free trial!`
      );
    }

    const today = new Date();

    siteOptions.forEach((site) => {
      if (selectedSites[site.id]) {
        const url = typeof site.url === "function" ? site.url(today) : site.url;
        if (site.openInSingleBrowser) {
          browser.windows.create({ url });
        } else {
          browser.tabs.create({ url });
        }
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
        {/* 总开关 */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  isContentScriptEnabled ? "bg-green-500" : "bg-red-500"
                )}
              ></div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900">Enable Scraper</h3>
                {/* 帮助图标和tooltip */}
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    <span className="text-xs font-medium">?</span>
                  </button>
                  {showTooltip && (
                    <div className="absolute left-1/2 top-6 z-50 w-50 -translate-x-1/2 rounded-lg bg-gray-900 p-3 text-white shadow-lg">
                      <div className="text-sm">
                        Extensions perform automated actions on specified pages,
                        such as auto‑scrolling and automatically opening product
                        links. These features can be temporarily disabled if you
                        don’t need them.
                      </div>
                      <div className="absolute left-1/2 -top-2 -translate-x-1/2 h-0 w-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleContentScriptToggle}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isContentScriptEnabled ? "bg-primary" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  isContentScriptEnabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        <h2 className="mb-4 text-center text-xl font-bold">
          Select websites to scrape
        </h2>
        <div
          className={cn(
            "grid grid-cols-2 gap-2",
            !isContentScriptEnabled && "opacity-50 pointer-events-none"
          )}
        >
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="daily"
              checked={groupSelection.daily}
              onChange={() => handleGroupCheckboxChange("daily")}
              disabled={!isContentScriptEnabled}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={!isContentScriptEnabled}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={!isContentScriptEnabled}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label htmlFor={site.id} className="text-sm font-medium">
                {site.name}
              </label>
            </div>
          ))}
        </div>
        <Button
          onClick={handleStartScraping}
          disabled={
            !isContentScriptEnabled || (!hasPurchased && !trialInfo.isTrial)
          }
          className={cn(
            "mt-6 w-full rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            isContentScriptEnabled && (hasPurchased || trialInfo.isTrial)
              ? "cursor-pointer bg-primary text-white hover:bg-primary/90"
              : "cursor-not-allowed bg-gray-300 text-gray-500"
          )}
        >
          {!isContentScriptEnabled
            ? "⚡ Email Scraper Disabled"
            : hasPurchased
            ? "Start Scraping"
            : trialInfo.isTrial
            ? `🎯 Start Scraping (${trialInfo.daysLeft} days left)`
            : "🔒 Premium Required"}
        </Button>
        <div id="purchase" className="my-8">
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              🚀 Unlock Premium Features
            </h2>
            <p className="text-gray-600">
              Get unlimited access to all scraping features
            </p>

            {/* 试用状态提示 */}
            {trialInfo.isTrial && !hasPurchased && (
              <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <p className="font-semibold text-blue-800">
                      Free Trial Active
                    </p>
                    <p className="text-sm text-blue-600">
                      {trialInfo.daysLeft} days remaining in your trial
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!trialInfo.hasStarted && !hasPurchased && (
              <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex flex-col items-center space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">🎁</span>
                    <div>
                      <p className="font-semibold text-yellow-800">
                        3-Day Free Trial
                      </p>
                      <p className="text-sm text-yellow-600">
                        Try all features before purchasing
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={startTrial}
                    className="w-full cursor-pointer bg-yellow-500 hover:bg-yellow-600 text-white font-semibold"
                    size="sm"
                  >
                    🚀 Start Free Trial
                  </Button>
                  <p className="mt-1 text-sm text-green-600 font-medium">
                    No Credit Card Required
                  </p>
                </div>
              </div>
            )}

            {trialInfo.hasStarted && !trialInfo.isTrial && !hasPurchased && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <p className="font-semibold text-red-800">Trial Expired</p>
                    <p className="text-sm text-red-600">
                      Your 3-day free trial has ended
                    </p>
                  </div>
                </div>
              </div>
            )}
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
