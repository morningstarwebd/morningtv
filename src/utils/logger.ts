// src/utils/logger.ts
// Production-grade structured frontend logger with context tracking and error forwarding

import { invoke } from "@tauri-apps/api/core";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	context: string;
	message: string;
	data?: Record<string, unknown> | unknown;
}

class Logger {
	private readonly context: string;

	constructor(context: string) {
		this.context = context;
	}

	debug(message: string, data?: unknown): void {
		this.log("debug", message, data);
	}

	info(message: string, data?: unknown): void {
		this.log("info", message, data);
	}

	warn(message: string, data?: unknown): void {
		this.log("warn", message, data);
	}

	error(message: string, data?: unknown): void {
		this.log("error", message, data);
	}

	private log(level: LogLevel, message: string, data?: unknown): void {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			context: this.context,
			message,
			data:
				data !== undefined
					? typeof data === "object"
						? data
						: { detail: data }
					: undefined,
		};

		const prefix = `[${entry.timestamp}] [${this.context}] [${level.toUpperCase()}]:`;

		switch (level) {
			case "debug":
				if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
					console.debug(prefix, message, data ?? "");
				}
				break;
			case "info":
				console.info(prefix, message, data ?? "");
				break;
			case "warn":
				console.warn(prefix, message, data ?? "");
				break;
			case "error":
				console.error(prefix, message, data ?? "");
				// Forward critical errors to Rust backend logger for persistence
				invoke("log_frontend_error", {
					level,
					context: this.context,
					message: `${message}${data ? ` | ${JSON.stringify(data)}` : ""}`,
				}).catch(() => {
					// Fallback silently if Tauri IPC is not available (e.g. during headless web tests)
				});
				break;
		}
	}
}

export function createLogger(context: string): Logger {
	return new Logger(context);
}

export const logger = createLogger("App");
