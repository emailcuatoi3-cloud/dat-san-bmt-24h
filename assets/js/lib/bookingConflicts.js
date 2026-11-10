const OCCUPYING_STATUSES = ["pending", "confirmed"];
const detectBookingConflicts = (target, bookings, blockedSlots) => {
  const overlaps = bookings.filter((item) => item.id !== target.id).filter((item) => item.courtId === target.courtId && item.date === target.date).filter((item) => OCCUPYING_STATUSES.includes(item.status)).map((item) => ({
    booking: item,
    slots: item.slots.filter((slot) => target.slots.includes(slot))
  })).filter((item) => item.slots.length > 0).sort((first, second) => first.slots[0].localeCompare(second.slots[0]));
  const blocked = blockedSlots[`${target.courtId}:${target.date}`] || [];
  const blockedOverlap = target.slots.filter((slot) => blocked.includes(slot));
  return {
    overlaps,
    blockedSlots: blockedOverlap,
    hasConflict: overlaps.length > 0 || blockedOverlap.length > 0
  };
};
const collectConflictIds = (bookings, blockedSlots) => {
  const ids = /* @__PURE__ */ new Set();
  bookings.forEach((booking) => {
    if (!OCCUPYING_STATUSES.includes(booking.status)) return;
    if (detectBookingConflicts(booking, bookings, blockedSlots).hasConflict) ids.add(booking.id);
  });
  return ids;
};
export {
  collectConflictIds,
  detectBookingConflicts
};
