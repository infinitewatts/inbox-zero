"use client";

import { useEffect } from "react";
import { logOut } from "@/utils/user";
import { createClientLogger } from "@/utils/logger-client";

const logger = createClientLogger("auto-log-out");

export default function AutoLogOut(props: { loggedIn: boolean }) {
  useEffect(() => {
    // this may fix the sign in error
    // have been seeing this error when a user is not properly logged out and an attempt is made to link accounts instead of logging in.
    if (props.loggedIn) {
      logger.info("Logging user out");
      logOut();
    }
  }, [props.loggedIn]);

  return null;
}
