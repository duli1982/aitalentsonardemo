import React, { useState, useEffect } from 'react';

const OutreachContent: React.FC<{ message: string }> = ({ message }) => {
    const [editedMessage, setEditedMessage] = useState(message);
    useEffect(() => setEditedMessage(message), [message]);

    return (
        <textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            className="w-full h-64 p-3 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none resize-none text-sm text-gray-200 custom-scrollbar"
        />
    );
};

export default OutreachContent;
