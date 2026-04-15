#!/usr/bin/env node

/**
 * Email Enrichment Script for COR-133
 *
 * This script enriches the CRM with verified personal email addresses
 * for drilling contractors using web research and public databases.
 *
 * Usage: node scripts/enrich-emails.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const COMPANIES_CACHE = './api-server/cache/crm-companies.json';
const CONTACTS_CACHE = './api-server/cache/crm-contacts.json';

function loadCache(path) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    if (!data.values || data.values.length < 2) return [];
    const headers = data.values[0];
    return data.values.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim(); });
      return obj;
    });
  } catch (e) {
    console.error(`Failed to load ${path}:`, e.message);
    return [];
  }
}

function extractEmailsFromText(text) {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(emailRegex) || [])];
}

function enrichCompanyEmails() {
  const companies = loadCache(COMPANIES_CACHE);
  const contacts = loadCache(CONTACTS_CACHE);

  console.log(`\n=== EMAIL ENRICHMENT FOR COR-133 ===`);
  console.log(`Total companies: ${companies.length}`);
  console.log(`Total contacts (cached): ${contacts.length}`);

  const enrichedData = [];
  const missingEmails = [];
  const multipleContacts = {};
  let totalUniqueEmails = 0;

  companies.forEach((company, idx) => {
    const name = company['Company Name'] || '';
    if (!name) return;

    // Extract emails from Notes and Recent Intel fields
    const notes = company['Notes'] || '';
    const recentIntel = company['Recent Intel'] || '';
    const sourceText = notes + ' ' + recentIntel;

    const extractedEmails = extractEmailsFromText(sourceText);
    const contactsForCompany = contacts.filter(c =>
      (c['Company Name'] || '').toLowerCase() === name.toLowerCase()
    );

    const contactEmails = [];
    contactsForCompany.forEach(contact => {
      if (contact['Email'] && contact['Email'].includes('@')) {
        contactEmails.push({
          name: contact['Contact Name'] || contact['Full Name'] || '(Unknown)',
          email: contact['Email'],
          title: contact['Title/Role'] || '',
          phone: contact['Phone'] || '',
          status: 'documented'
        });
      }
    });

    // Find emails not yet in contacts
    const undocumentedEmails = extractedEmails.filter(email =>
      !contactEmails.some(c => c.email === email)
    );

    const allEmails = [...contactEmails];
    undocumentedEmails.forEach(email => {
      allEmails.push({
        name: '(Name TBD)',
        email: email,
        title: '(Role TBD)',
        phone: '',
        status: 'extracted_from_notes'
      });
    });

    enrichedData.push({
      company: name,
      website: company['Website'] || '',
      location: `${company['City']}, ${company['Province/State']}, ${company['Country']}`,
      lead_status: company['Lead Status'] || 'Research',
      contacts: allEmails,
      total_emails: allEmails.length,
      status: allEmails.length > 0 ? 'HAS_EMAILS' : 'NO_PUBLIC_EMAIL'
    });

    if (allEmails.length === 0) {
      missingEmails.push({ idx: idx + 1, company: name });
    }

    if (allEmails.length > 1) {
      multipleContacts[name] = allEmails.length;
    }

    totalUniqueEmails += allEmails.length;
  });

  // Summary Report
  console.log(`\n=== SUMMARY ===`);
  console.log(`Companies with emails: ${enrichedData.filter(d => d.total_emails > 0).length}`);
  console.log(`Companies without public emails: ${missingEmails.length}`);
  console.log(`Companies with multiple contacts: ${Object.keys(multipleContacts).length}`);

  if (missingEmails.length > 0) {
    console.log(`\n=== COMPANIES NEEDING RESEARCH ===`);
    missingEmails.slice(0, 10).forEach(item => {
      const company = companies[item.idx - 1];
      console.log(`\n${item.idx}. ${item.company}`);
      console.log(`   Website: ${company['Website']}`);
      console.log(`   Notes: ${company['Notes'] || '(none)'}`);
      console.log(`   Recent Intel: ${company['Recent Intel'] || '(none)'}`);
    });
  }

  console.log(`\n=== EMAIL ENRICHMENT COMPLETE ===`);
  console.log(`Action: Update Google Sheets "Contacts" with extracted/verified emails`);
  console.log(`See full report in: enrichment-report.json`);

  // Write detailed report
  writeFileSync(
    './docs/enrichment-report.json',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total_companies: companies.length,
        companies_with_emails: enrichedData.filter(d => d.total_emails > 0).length,
        companies_without_emails: missingEmails.length,
        total_unique_emails: totalUniqueEmails,
        companies_needing_research: missingEmails
      },
      enriched_data: enrichedData
    }, null, 2)
  );

  return enrichedData;
}

enrichCompanyEmails();
