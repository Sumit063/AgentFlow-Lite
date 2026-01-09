// submit.js

import { useMemo, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useStore } from './store';

const selector = (state) => ({
    nodes: state.nodes,
    edges: state.edges,
});

export const SubmitButton = () => {
    const { nodes, edges } = useStore(selector, shallow);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalState, setModalState] = useState({
        isOpen: false,
        status: 'success',
        payload: null,
        message: '',
    });
    const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`${apiBaseUrl}/pipelines/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodes, edges }),
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const data = await response.json();
            setModalState({
                isOpen: true,
                status: 'success',
                payload: data,
                message: '',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const hint =
                message === 'Failed to fetch'
                    ? 'Failed to fetch. Ensure the backend is running on http://localhost:8000.'
                    : message;
            setModalState({
                isOpen: true,
                status: 'error',
                payload: null,
                message: hint,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeModal = () => {
        setModalState((prev) => ({ ...prev, isOpen: false }));
    };

    const dagSummary = useMemo(() => {
        if (!modalState.payload) {
            return null;
        }
        return modalState.payload.is_dag
            ? 'Pipeline is a valid DAG.'
            : 'Pipeline contains a cycle.';
    }, [modalState.payload]);

    return (
        <>
            <button
                type="button"
                className="primary-button"
                onClick={handleSubmit}
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Analyzing...' : 'Submit Pipeline'}
            </button>
            {modalState.isOpen ? (
                <div className="modal-backdrop" onClick={closeModal} role="presentation">
                    <div
                        className={`modal-card ${
                            modalState.status === 'error' ? 'modal-error' : ''
                        }`}
                        role="dialog"
                        aria-modal="true"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div className="modal-title">
                                {modalState.status === 'error'
                                    ? 'Pipeline Check Failed'
                                    : 'Pipeline Analysis'}
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={closeModal}
                            >
                                x
                            </button>
                        </div>
                        {modalState.status === 'error' ? (
                            <div className="modal-body">
                                <div className="modal-message">{modalState.message}</div>
                            </div>
                        ) : (
                            <div className="modal-body">
                                <div className="modal-grid">
                                    <div className="modal-stat">
                                        <div className="modal-label">Nodes</div>
                                        <div className="modal-value">
                                            {modalState.payload?.num_nodes ?? 0}
                                        </div>
                                    </div>
                                    <div className="modal-stat">
                                        <div className="modal-label">Edges</div>
                                        <div className="modal-value">
                                            {modalState.payload?.num_edges ?? 0}
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-pill">
                                    <span
                                        className={
                                            modalState.payload?.is_dag
                                                ? 'pill-good'
                                                : 'pill-warn'
                                        }
                                    >
                                        {modalState.payload?.is_dag
                                            ? 'DAG validated'
                                            : 'Cycle detected'}
                                    </span>
                                    <span className="pill-note">{dagSummary}</span>
                                </div>
                            </div>
                        )}
                        <div className="modal-footer">
                            <button type="button" className="modal-action" onClick={closeModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
};
