'use client'
import { useState } from "react";
import "./SearchBox.css"

interface TagPillProps {
    name: string,
    onRemove: () => void,
}

function TagPill({ name, onRemove }: TagPillProps) {
    return (
        <div className="tag-pill">
            <button 
                type="button" 
                onClick={onRemove} 
                className="tag-remove-btn"
                aria-label={`Remove ${name} tag`}
            >
                ×
            </button>
            <span>{name}</span>
        </div>
    );
}

interface SearchBoxProps {
    tagList: string[],
}

export function SearchBox({ tagList }: SearchBoxProps) {
    const [tagText, setTagText] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    console.log(tagText);

    return (
        <div className="search-box-container">
            {tags.map((tag) => (
                <TagPill
                    key={tag}
                    name={tag}
                    onRemove={() => {
                        setTags(tags.filter((t) => t !== tag))
                    }}/>
            ))}
            <input
                className="search-input"
                placeholder="Input a tag..."
                value={tagText}
                onChange={(e) => {
                    setTagText(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key == ' ') {
                        e.preventDefault();
                        const trimmedTag = tagText.trim().toLowerCase();

                        if (tagList.includes(trimmedTag) && !tags.includes(trimmedTag)) {
                            setTags([...tags, trimmedTag]);
                        }

                        setTagText('');
                    } else if (e.key === 'Backspace' && tagText === '' && tags.length > 0) {
                        setTags(tags.slice(0, -1));
                    }
                }}
            />
        </div>
    );
}
