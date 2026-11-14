import { Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import pool from '@/lib/db';
import { notFound } from 'next/navigation';

export const instant = false;

async function MarkdownContent({ pid }: { pid: string }) {
    let pageMd: string | undefined;

    try {
        const queryText = 'SELECT markdown FROM pages WHERE pid = $1';
        const res = await pool.query(
            'SELECT markdown FROM pages WHERE pid = $1',
            [pid]
        );

        pageMd = res.rows[0]?.markdown;
    } catch (err) {
        console.error('Database query error:', err);
        return <p>Error loading this page content.</p>
    }

    if (pageMd === undefined) {
        notFound();
    }

    return <ReactMarkdown>{pageMd}</ReactMarkdown>
}

interface MarkdownPageProps {
    params: Promise<{ pid: string }>;
};

export default async function MarkdownPage({ params }: MarkdownPageProps) {
    const { pid } = await params;

    return (
        <main>
            <h1>Page ID: {pid}</h1>
            <MarkdownContent pid={pid} />
        </main>
    );
}
