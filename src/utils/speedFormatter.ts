// src/utils/speedFormatter.ts
// Precision network & bitrate speed formatting in Bytes/sec (KB/s, MB/s) and bits/sec (Mbps)

export interface FormattedSpeed {
	formatted: string; // e.g. "2.84 MB/s" or "325.4 KB/s"
	value: string; // "2.84"
	unit: string; // "MB/s"
	mbps: string; // "22.7 Mbps"
}

/**
 * Formats a speed given in Bytes per second into mobile-style KB/s and MB/s (Bytes = bits / 8),
 * alongside its equivalent Mbps value.
 */
export function formatBytesPerSec(bytesPerSec: number): FormattedSpeed {
	if (!bytesPerSec || bytesPerSec <= 0 || !isFinite(bytesPerSec)) {
		return { formatted: "0 KB/s", value: "0", unit: "KB/s", mbps: "0 Mbps" };
	}

	const mbpsVal = ((bytesPerSec * 8) / 1000000).toFixed(1);
	const mbps = `${mbpsVal} Mbps`;

	if (bytesPerSec < 1024) {
		const val = Math.round(bytesPerSec).toString();
		return { formatted: `${val} B/s`, value: val, unit: "B/s", mbps };
	}

	if (bytesPerSec < 1024 * 1024) {
		const val = (bytesPerSec / 1024).toFixed(1);
		return { formatted: `${val} KB/s`, value: val, unit: "KB/s", mbps };
	}

	const val = (bytesPerSec / (1024 * 1024)).toFixed(2);
	return { formatted: `${val} MB/s`, value: val, unit: "MB/s", mbps };
}
