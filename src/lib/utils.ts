/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function handleFirestoreError(error: any, operation: string, path: string | null = null) {
  console.error(`Firestore error during ${operation}:`, error);
  // This app doesn't use Firestore yet, but we define the helper for consistency
}
