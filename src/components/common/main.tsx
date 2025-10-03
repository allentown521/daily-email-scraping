import { browser } from "wxt/browser";
import { useState } from "react";
import Logo from "~/assets/logo.svg?react";
import { cn } from "~/lib/utils";

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

        // 计算当前是一年中的第几周
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

  const handleStartScraping = () => {
    const today = new Date();

    siteOptions.forEach((site) => {
      if (selectedSites[site.id]) {
        const url = typeof site.url === "function" ? site.url(today) : site.url;
        browser.tabs.create({ url });
      }
    });
  };

  return (
    <main
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-6",
        className
      )}
    >
      <Logo className="w-24 text-primary" />
      <div className="w-full max-w-md">
        <h2 className="mb-4 text-center text-xl font-bold">选择要抓取的网站</h2>
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
              日计划
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
              周计划
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
        <button
          onClick={handleStartScraping}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          开始抓取
        </button>
      </div>
    </main>
  );
};
