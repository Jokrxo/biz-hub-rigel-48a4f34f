import React from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { JournalEntry } from "@/components/Journals/JournalEntry";
import SEO from "@/components/SEO";

export default function JournalsPage() {
  return (
    <>
      <SEO title="Journal Entry | Rigel Business" description="Post general journal entries" />
      <DashboardLayout>
        <JournalEntry />
      </DashboardLayout>
    </>
  );
}
