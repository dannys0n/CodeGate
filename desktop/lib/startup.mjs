function sameText(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
}

export function isStartupEnabled(settings, options) {
  if (settings.openAtLogin) return true;
  return settings.launchItems?.some((item) =>
    item.name === 'CodeGate'
    && item.enabled
    && sameText(item.path, options.path)
    && item.args?.length === options.args.length
    && item.args.every((argument, index) => sameText(argument, options.args[index]))
  ) ?? false;
}
