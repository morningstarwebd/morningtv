// src/hooks/useWakeLock.ts
// Prevents screen dimming or sleep during active video playback

import { useEffect, useRef } from "react";
import { createLogger } from "../utils/logger";

const log = createLogger("WakeLock");

export function useWakeLock(isActive: boolean): void {
	const sentinelRef = useRef<WakeLockSentinel | null>(null);

	useEffect(() => {
		let isMounted = true;

		async function requestLock() {
			if ("wakeLock" in navigator && isActive) {
				try {
					const lock = await navigator.wakeLock.request("screen");
					if (!isMounted) {
						lock.release().catch(() => {});
						return;
					}
					sentinelRef.current = lock;
					sentinelRef.current.addEventListener("release", () => {
						log.debug("Screen wake lock released");
					});
					log.debug("Screen wake lock acquired");
				} catch (err) {
					log.warn("Wake lock request failed", { error: err });
				}
			}
		}

		if (isActive) {
			requestLock();
		} else if (sentinelRef.current) {
			sentinelRef.current.release().catch(() => {});
			sentinelRef.current = null;
		}

		return () => {
			isMounted = false;
			if (sentinelRef.current) {
				sentinelRef.current.release().catch(() => {});
				sentinelRef.current = null;
			}
		};
	}, [isActive]);
}
