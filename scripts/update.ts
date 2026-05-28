#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';

const root = join(import.meta.dir, '..');
const siteRoot = join(root, 'site');
const packageJson = join(root, 'package.json');
const bunLock = join(root, 'bun.lock');
const sitePackageJson = join(siteRoot, 'package.json');
const siteBunLock = join(siteRoot, 'bun.lock');
const hero = join(siteRoot, 'src/components/Hero.astro');
// Bun may normalize lockfile metadata on a second no-op update. Package
// manifests are the durable signal that a refresh actually changed versions.
const dependencyManifests = [packageJson, sitePackageJson];
const dependencyFiles = [packageJson, bunLock, sitePackageJson, siteBunLock];

function snapshot(paths: string[]) {
  return new Map(paths.map((path) => [path, existsSync(path) ? readFileSync(path, 'utf8') : '']));
}

function changed(before: Map<string, string>, paths: string[]) {
  return paths.filter(
    (path) => before.get(path) !== (existsSync(path) ? readFileSync(path, 'utf8') : ''),
  );
}

function label(path: string) {
  return path.startsWith(siteRoot)
    ? `site/${path.slice(siteRoot.length + 1)}`
    : path.slice(root.length + 1);
}

function pacificTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part('month')} ${part('day')}, ${part('year')}, ${part('hour')}:${part('minute')} ${part('dayPeriod')} PT`;
}

function refreshHomepageTimestamp() {
  const current = readFileSync(hero, 'utf8');
  const next = current.replace(
    /Last dependency refresh: .*?\./,
    `Last dependency refresh: ${pacificTimestamp()}.`,
  );

  if (next === current) {
    throw new Error('Expected Hero.astro to contain a “Last dependency refresh:” marker.');
  }

  writeFileSync(hero, next);
}

const before = snapshot(dependencyFiles);

console.log('Updating root dependencies with bun update…');
await $`bun update`.cwd(root);
console.log('Updating site dependencies with bun update…');
await $`bun update`.cwd(siteRoot);

const changedFiles = changed(before, dependencyFiles);
const changedManifests = changed(before, dependencyManifests);
if (changedManifests.length > 0) {
  refreshHomepageTimestamp();
  console.log(`Dependency files changed: ${changedFiles.map(label).join(', ')}`);
  console.log('Refreshed the homepage dependency timestamp.');
} else if (changedFiles.length > 0) {
  console.log(`Only lockfiles were normalized: ${changedFiles.map(label).join(', ')}`);
  console.log('Homepage timestamp left alone because package versions did not change.');
} else {
  console.log('No package manifest or lockfile changes; homepage timestamp left alone.');
}

console.log('Validating the repo and rebuilding the homepage…');
await $`bun run check:update`.cwd(root);
console.log(
  'Update flow complete. If Flue/runtime behavior changed, run any affected bun ex:/rx:/tpl: E2E targets before shipping.',
);
