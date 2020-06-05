#!/usr/bin/env -S deno

import { tasklist, OutputMode } from "./mod.ts";

function getHelpText(): string {
  return `
    Example
      $ win-tasklist
    `;
}

function help(): void {
  const helpText = getHelpText();
  console.log(helpText);
}

async function cli() {
  const args = Deno.args;

  if (args[0] === "--help" || args[0] === "h" || args[0] === "help") {
    help();
    Deno.exit();
  }

  try {
    console.log(
      (
        await tasklist({
          output: OutputMode.Table,
        })
      ).output
    );
  } catch (error) {
    console.log(error);
  }
}

cli();
