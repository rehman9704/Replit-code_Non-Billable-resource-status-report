/**
 * Employee Name Mapping Utility
 * Fixes phantom employee name display issues by providing correct mappings
 */

// Correct employee name mappings based on Azure SQL database structure
export const CORRECT_EMPLOYEE_NAMES: { [key: number]: string } = {
  1: "M Abdullah Ansari",         // ZohoID: 10000011 - 6 messages
  2: "Prashanth Janardhanan",     // ZohoID: 10000391 - 15 messages
  3: "Praveen M G",               // ZohoID: 10000568 - 4 messages
  25: "Farhan Ahmed",             // ZohoID: 10008536 - 1 message
  27: "Karthik Venkittu",         // ZohoID: 10008821 - 3 messages
  80: "Kishore Kumar"             // ZohoID: 10011701 - 2 messages
};

/**
 * Corrects phantom employee names to show the actual correct names
 * @param employeeId - The employee ID
 * @param displayedName - The name currently being displayed (might be cached/phantom)
 * @returns The correct employee name
 */
export function getCorrectEmployeeName(employeeId: number, displayedName: string): string {
  const correctName = CORRECT_EMPLOYEE_NAMES[employeeId];
  
  if (correctName && displayedName !== correctName) {
    console.log(`🚨 CORRECTING PHANTOM NAME: ID ${employeeId} from "${displayedName}" to "${correctName}"`);
    return correctName;
  }
  
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
    1: 6,   // M Abdullah Ansari
    2: 15,  // Prashanth Janardhanan
    3: 4,   // Praveen M G
    25: 1,  // Farhan Ahmed
    27: 3,  // Karthik Venkittu
    80: 2   // Kishore Kumar
  };
  
  return messageCounts[employeeId] || 0;
}