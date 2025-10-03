// Import only what we need to reduce bundle size
import { format, formatDistanceToNow, parseISO, differenceInMinutes, isAfter, isBefore, isToday } from 'date-fns';

// Type definitions for better type safety
type DateInput = string | number | Date;

// Format a date string to a readable format
export const formatDate = (dateInput: DateInput, formatStr = 'PPpp') => {
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
  return format(date, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

// Format a duration in minutes to HH:MM format
export const formatDuration = (minutes: number): string => {
  if (isNaN(minutes) || minutes < 0) return '00:00';
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.floor(minutes % 60);
  
  return `${hours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}`;
};

// Calculate time ago from a date string
export const timeAgo = (dateInput: DateInput) => {
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
  return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error calculating time ago:', error);
    return '';
  }
};

// Calculate total driving time between two dates in minutes
export const calculateDrivingTime = (start: DateInput, end: DateInput): number => {
  try {
    const startDate = typeof start === 'string' ? parseISO(start) : new Date(start);
    const endDate = typeof end === 'string' ? parseISO(end) : new Date(end);
    return differenceInMinutes(endDate, startDate);
  } catch (error) {
    console.error('Error calculating driving time:', error);
    return 0;
  }
};

// Check if a time period is within HOS limits
export const isWithinHOSLimits = (start: DateInput, end: DateInput): { isWithinLimit: boolean; remainingMinutes: number } => {
  const MAX_DRIVING_HOURS = 11 * 60; // 11 hours in minutes
  const drivingTime = calculateDrivingTime(start, end);
  const remainingMinutes = MAX_DRIVING_HOURS - drivingTime;
  
  return {
    isWithinLimit: drivingTime <= MAX_DRIVING_HOURS,
    remainingMinutes: Math.max(0, remainingMinutes),
  };
};

// Format a date to ISO string without timezone offset
export const toLocalISOString = (dateInput: DateInput): string => {
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
  } catch (error) {
    console.error('Error converting to local ISO string:', error);
    return new Date().toISOString();
  }
};

// Check if a date is in the future
export const isFutureDate = (dateInput: DateInput): boolean => {
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    return isAfter(date, new Date());
  } catch (error) {
    console.error('Error checking future date:', error);
    return false;
  }
};

// Check if a date is in the past
export const isPastDate = (dateInput: DateInput): boolean => {
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    return isBefore(date, new Date());
  } catch (error) {
    console.error('Error checking past date:', error);
    return false;
  }
};

// Add minutes to a date and return a new date string
export const addMinutesToDate = (dateInput: DateInput, minutesToAdd: number): string => {
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    const newDate = new Date(date.getTime() + minutesToAdd * 60000);
    return newDate.toISOString();
  } catch (error) {
    console.error('Error adding minutes to date:', error);
    return new Date().toISOString();
  }
};

// Check if a date is today
export const isDateToday = (dateInput: DateInput): boolean => {
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    return isToday(date);
  } catch (error) {
    console.error('Error checking if date is today:', error);
    return false;
  }
};

// Format a time to 12-hour format
export const formatTime12Hour = (timeInput: DateInput): string => {
  try {
    const date = typeof timeInput === 'string' ? parseISO(timeInput) : new Date(timeInput);
    return format(date, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time to 12-hour format:', error);
    return '';
  }
};
