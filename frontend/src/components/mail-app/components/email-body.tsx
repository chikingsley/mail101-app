import { useEffect, useState } from "react";
import { useSession } from "@clerk/clerk-react";
import DOMPurify from "dompurify";
import { Loader2 } from "lucide-react";

const BACKEND_URL = process.env.BUN_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface EmailBodyProps {
	emailId: string;
	fallbackText: string;
}

interface EmailBodyContent {
	contentType: string;
	content: string;
}

export function EmailBody({ emailId, fallbackText }: EmailBodyProps) {
	const { session } = useSession();
	const [body, setBody] = useState<EmailBodyContent | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchBody = async () => {
			if (!session || !emailId) return;

			setLoading(true);
			setError(null);

			try {
				const token = await session.getToken();
				const response = await fetch(`${BACKEND_URL}/api/emails/${emailId}/body`, {
					headers: {
						'Authorization': `Bearer ${token}`,
					},
				});

				const data = await response.json();

				if (data.success && data.body) {
					setBody(data.body);
				} else {
					setError(data.error || 'Failed to load email body');
				}
			} catch (err) {
				console.error('Failed to fetch email body:', err);
				setError('Failed to load email content');
			} finally {
				setLoading(false);
			}
		};

		fetchBody();
	}, [session, emailId]);

	if (loading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4">
				<p className="text-sm text-muted-foreground mb-2">Could not load full email content</p>
				<div className="text-sm whitespace-pre-wrap">{fallbackText}</div>
			</div>
		);
	}

	if (!body) {
		return (
			<div className="p-4 text-sm whitespace-pre-wrap">
				{fallbackText}
			</div>
		);
	}

	// Check if content is HTML
	const isHtml = body.contentType?.toLowerCase() === 'html';

	if (isHtml) {
		// Sanitize HTML content
		const sanitizedHtml = DOMPurify.sanitize(body.content, {
			ALLOWED_TAGS: [
				'p', 'br', 'div', 'span', 'a', 'b', 'strong', 'i', 'em', 'u',
				'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
				'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
				'table', 'thead', 'tbody', 'tr', 'th', 'td',
				'img', 'hr',
			],
			ALLOWED_ATTR: [
				'href', 'src', 'alt', 'title', 'class', 'style',
				'target', 'rel', 'width', 'height',
				'border', 'cellpadding', 'cellspacing', 'align', 'valign',
			],
			ALLOW_DATA_ATTR: false,
			ADD_ATTR: ['target'],
			FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
			FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
		});

		// Add target="_blank" to all links for security
		const processedHtml = sanitizedHtml.replace(
			/<a\s+(?![^>]*target=)/gi,
			'<a target="_blank" rel="noopener noreferrer" '
		);

		return (
			<div className="p-4">
				<div
					className="email-body-content prose prose-sm dark:prose-invert max-w-none"
					dangerouslySetInnerHTML={{ __html: processedHtml }}
				/>
				<style>{`
					.email-body-content {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
						line-height: 1.5;
						word-break: break-word;
					}
					.email-body-content img {
						max-width: 100%;
						height: auto;
					}
					.email-body-content a {
						color: hsl(var(--primary));
						text-decoration: underline;
					}
					.email-body-content a:hover {
						opacity: 0.8;
					}
					.email-body-content blockquote {
						border-left: 3px solid hsl(var(--muted));
						padding-left: 1rem;
						margin-left: 0;
						color: hsl(var(--muted-foreground));
					}
					.email-body-content table {
						border-collapse: collapse;
						width: 100%;
					}
					.email-body-content th,
					.email-body-content td {
						border: 1px solid hsl(var(--border));
						padding: 0.5rem;
					}
					.email-body-content pre {
						background: hsl(var(--muted));
						padding: 1rem;
						border-radius: 0.5rem;
						overflow-x: auto;
					}
				`}</style>
			</div>
		);
	}

	// Plain text content - preserve whitespace
	return (
		<div className="p-4 text-sm whitespace-pre-wrap font-mono">
			{body.content}
		</div>
	);
}
