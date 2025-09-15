import { LogIn, UserRound } from "lucide-react";
import { browser } from "wxt/browser";
import {} from "~/lib/messaging";

import { StorageKey, useStorage } from "@/lib/storage";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { betterAuth } from "~/lib/supabase";
import { getAvatar, getName } from "~/lib/utils";

const AnonymousUser = () => {
  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full"
      onClick={() => {
        browser.tabs.create({
          url: "tabs.html#login",
        });
      }}
    >
      <LogIn className="size-4" />
    </Button>
  );
};

export const User = () => {
  const { data } = useStorage(StorageKey.USER);

  if (!data) {
    return <AnonymousUser />;
  }

  const name = getName(data);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Avatar className="size-10">
            <AvatarImage src={getAvatar(data)} alt={name} />
            <AvatarFallback>
              <UserRound className="size-5" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            {name && (
              <p className="font-sans text-sm font-medium leading-none">
                {name}
              </p>
            )}
            {data.email && (
              <p className="font-sans text-xs leading-none text-muted-foreground">
                {data.email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem className="cursor-pointer" asChild>
          <button
            type="button"
            className="w-full"
            onClick={() =>
              betterAuth.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    browser.tabs.update({
                      url: "options.html",
                    });
                  },
                },
              })
            }
          >
            {browser.i18n.getMessage("logout")}
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
