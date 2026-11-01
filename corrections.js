// Signs confirmed on the street that NYC's open data is missing.
// Key: NYC order number | side of street. Add a line for each new photo.
window.CORRECTIONS = {
  // W 33rd St, 5th Ave to Broadway, south side (18 W 33rd St): free outside its posted signs, confirmed Oct 31 2026
  "P-01789586|S": { date: "Oct 31, 2026", free: true, signs: [] },
  // E 33rd St, Madison Ave to 5th Ave, north side (photo, Oct 31 2026)
  "P-01624561|N": { date: "Oct 31, 2026", signs: ["5 HMP MONDAY-FRIDAY 7PM-MIDNIGHT SATURDAY 8AM-MIDNIGHT"] },
  // W 33rd St, 5th Ave to Broadway, north side: same sign set (photo, Oct 31 2026)
  "P-01708169|N": { date: "Oct 31, 2026", signs: ["5 HMP MONDAY-FRIDAY 7PM-MIDNIGHT SATURDAY 8AM-MIDNIGHT"] }
};
