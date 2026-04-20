import React from "react";

/**
 * Formats text with auto-capitalization rules:
 * 1. Capitalizes the very first letter.
 * 2. Capitalizes the first letter after a period and space (. )
 * 3. Capitalizes the first letter after a new bullet point (• )
 */
export const formatNotes = (text: string): string => {
  if (!text) return "";

  const lines = text.split('\n');

  const processedLines = lines.map((line, index) => {
    let processLine = line;
    let prefix = "";

    // Automatically add bullet to first line if it's missing
    if (index === 0 && !processLine.startsWith('• ') && !processLine.startsWith('- ') && processLine.length > 0) {
      if (processLine.startsWith('•')) {
        processLine = processLine.substring(1).trimStart();
      }
      prefix = '• ';
    } else if (processLine.startsWith('• ')) {
      prefix = '• ';
      processLine = processLine.substring(2);
    } else if (processLine.startsWith('- ')) {
      prefix = '- ';
      processLine = processLine.substring(2);
    } else if (processLine.startsWith('•')) {
      prefix = '• ';
      processLine = processLine.substring(1).trimStart();
    }

    if (!processLine) return prefix;

    // Capitalize first letter of the line
    processLine = processLine.charAt(0).toUpperCase() + processLine.slice(1);

    // If period is followed immediately by a letter, add space and capitalize
    processLine = processLine.replace(/\.([a-zA-ZñÑáéíóúÁÉÍÓÚ])/g, (match, letter) => {
      return ". " + letter.toUpperCase();
    });

    // If period is followed by space(s) and a lowercase letter, capitalize it
    processLine = processLine.replace(/\. +([a-zñáéíóú])/g, (match, letter) => {
      return ". " + letter.toUpperCase();
    });

    return prefix + processLine;
  });

  return processedLines.join('\n');
};

/**
 * Handles the Enter keydown event to automatically insert bullet points
 * and maintain the cursor position.
 */
export const handleNotesKeyDown = (
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  currentValue: string,
  onChange: (value: string) => void
) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const textarea = e.currentTarget;
    const cursorPosition = textarea.selectionStart;

    const textBefore = currentValue.substring(0, cursorPosition);
    const textAfter = currentValue.substring(cursorPosition);

    // Insert new line and bullet
    const newValue = textBefore + '\n• ' + textAfter;
    onChange(newValue);

    // Move the cursor right after the newly inserted bullet
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = cursorPosition + 3;
    }, 0);
  }
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(value);
};

export const formatCurrencyAxis = (value: number) => {
  return `S/ ${value}`;
};

export const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(' ')
    .map((word) => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};
