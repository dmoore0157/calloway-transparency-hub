export const CATEGORY_LABEL: Record<string, string> = { pothole: 'Pothole', washout: 'Washout / shoulder', drainage: 'Drainage / culvert', downed_tree: 'Downed tree', sign: 'Sign', bridge: 'Bridge', gravel_grading: 'Gravel / grading', vegetation: 'Mowing / vegetation', other: 'Other' };
export const SEVERITY: { key: string; label: string; county: string; hint: string }[] = [
  { key: 'emergency', label: 'Emergency', county: 'Emergency (e.g., downed trees, flooding)', hint: 'Call 911 first. Road blocked, flooding, tree down on a live road.' },
  { key: 'urgent', label: 'Urgent', county: 'Urgent (e.g., safety hazards)', hint: 'A safety hazard that needs attention this week.' },
  { key: 'routine', label: 'Routine', county: 'Routine (e.g., potholes, grading requests)', hint: 'Potholes, grading, mowing, signs.' },
  { key: 'long_term', label: 'Long-term', county: 'Long-term (e.g., drainage redesign)', hint: 'Needs planning or budget, like drainage redesign.' },
];
export const MAINTAINER_LABEL: Record<string, string> = { county: 'County road', state: 'State route (KYTC)', city_murray: 'City of Murray street', private: 'Private road', unknown: 'Maintainer unknown' };
export const COUNTY = { form_url: 'https://callowaycountyky.gov/calloway-county-road-concern/', road_dept_phone: '(270) 753-4846', sheriff_phone: '(270) 753-3151', hours: 'Monday to Friday, 7:00 a.m. to 3:30 p.m.', kytc_phone: '(270) 898-2431', kytc_label: 'KYTC District 1 (Paducah)', murray_phone: '(270) 762-0330', murray_label: 'City of Murray Street Department' };
