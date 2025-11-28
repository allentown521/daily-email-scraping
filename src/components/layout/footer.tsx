import { buttonVariants } from "~/components/ui/button";
import { browser } from "#imports";

export const Footer = () => {
  return (
    <footer className="flex w-full justify-center gap-2">
      <a
        href="mailto:product@focusapps.app?subject=Product Hunt Email Scraper"
        className={buttonVariants({
          variant: "outline",
          className: "w-[6.5rem]",
        })}
      >
        Contact Us{" "}
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <title>Email</title>
          <path
            fill="currentColor"
            d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
          />
        </svg>
      </a>

      <a
        href={browser.runtime.getURL("/help.html")}
        target="_blank"
        rel="noreferrer noopener"
        className={buttonVariants({
          variant: "outline",
          className: "w-[6.5rem]",
        })}
      >
        How to Use{" "}
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <title>Help</title>
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
          />
        </svg>
      </a>
    </footer>
  );
};
