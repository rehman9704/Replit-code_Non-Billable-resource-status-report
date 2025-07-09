/**
 * Employee Name Mapping Utility
 * Fixes phantom employee name display issues by providing correct mappings
 */

// Correct employee name mappings based on PostgreSQL database verified data
// DISABLED: Backend now handles all name corrections correctly
export const CORRECT_EMPLOYEE_NAMES: { [key: number]: string } = {
  // Frontend mapping disabled - backend handles all corrections
};

/**
 * Corrects phantom employee names to show the actual correct names
 * @param employeeId - The employee ID
 * @param displayedName - The name currently being displayed (might be cached/phantom)
 * @returns The correct employee name
 */
export function getCorrectEmployeeName(employeeId: number, displayedName: string): string {
  // Backend now handles all name corrections - no frontend override needed
  return displayedName;
}

/**
 * Checks if an employee ID has chat messages based on our known data
 * @param employeeId - The employee ID to check
 * @returns True if the employee has chat messages
 */
export function hasKnownChatMessages(employeeId: number): boolean {
  return CORRECT_EMPLOYEE_NAMES.hasOwnProperty(employeeId);
}

/**
 * Gets the message count for employees with known chat messages
 * @param employeeId - The employee ID
 * @returns The known message count or 0
 */
export function getKnownMessageCount(employeeId: number): number {
  const messageCounts: { [key: number]: number } = {
    1: 3,   // M Abdullah Ansari
    2: 6,   // Prashanth Janardhanan
    3: 0,   // Zaki Ahsan Khan (hidden - not in report)
    80: 2   // Praveen M G
  };
  
  return messageCounts[employeeId] || 0;
}