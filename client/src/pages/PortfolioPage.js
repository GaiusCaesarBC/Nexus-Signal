// client/src/pages/PortfolioPage.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { Edit, Trash2 } from 'lucide-react'; // Icons for edit and delete

// --- Styled Components ---
const PageContainer = styled.div`
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    color: #e2e8f0;
    background-color: #1a202c;
    min-height: calc(100vh - 120px); /* Adjust for Navbar and Footer height */
`;

const Header = styled.h1`
    font-size: 2.5rem;
    color: #667eea;
    margin-bottom: 2rem;
    text-align: center;
`;

const SectionTitle = styled.h2`
    font-size: 1.8rem;
    color: #63b3ed;
    margin-top: 2.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #4a5568;
    padding-bottom: 0.5rem;
`;

// --- Portfolio Summary ---
const SummaryGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2.5rem;
`;

const SummaryCard = styled.div`
    background-color: #2d3748;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    text-align: center;
    border: 1px solid #4a5568;
`;

const SummaryLabel = styled.p`
    font-size: 1rem;
    color: #a0aec0;
    margin-bottom: 0.5rem;
`;

const SummaryValue = styled.p`
    font-size: 2rem;
    font-weight: bold;
    color: ${props => props.type === 'positive' ? '#48bb78' : props.type === 'negative' ? '#f56565' : '#e2e8f0'};
`;

// --- Add Holding Form ---
const FormContainer = styled.div`
    background-color: #2d3748;
    padding: 2rem;
    border-radius: 8px;
    border: 1px solid #4a5568;
    margin-bottom: 2.5rem;
`;

const AddHoldingForm = styled.form`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1.5rem;
`;

const FormGroup = styled.div`
    display: flex;
    flex-direction: column;
`;

const Label = styled.label`
    font-size: 0.9rem;
    color: #a0aec0;
    margin-bottom: 0.5rem;
`;

const Input = styled.input`
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #4a5568;
    background-color: #1a202c;
    color: #e2e8f0;
    font-size: 1rem;

    &::placeholder {
        color: #a0aec0;
    }
`;

const Button = styled.button`
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    border: none;
    background-color: #4299e1;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
    grid-column: span var(--button-span, 1); /* For spanning columns dynamically */

    &:hover {
        background-color: #3182ce;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const Message = styled.div`
    background-color: ${props => props.type === 'success' ? '#2d3748' : '#c53030'};
    color: ${props => props.type === 'success' ? '#48bb78' : '#e0e0e0'};
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 20px;
    text-align: center;
`;

// --- Holdings Table ---
const TableContainer = styled.div`
    overflow-x: auto;
    margin-bottom: 2.5rem;
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    background-color: #2d3748;
    border-radius: 8px;
    overflow: hidden; // Ensures border-radius applies to table content
`;

const Th = styled.th`
    background-color: #4a5568;
    padding: 1rem;
    text-align: left;
    font-weight: bold;
    color: #e2e8f0;
    white-space: nowrap; // Prevent text wrapping
`;

const Td = styled.td`
    padding: 1rem;
    border-bottom: 1px solid #4a5568;
    color: #e2e8f0;
    white-space: nowrap; // Prevent text wrapping

    &:last-child {
        text-align: right;
    }
`;

const TdValue = styled(Td)`
    color: ${props => props.type === 'positive' ? '#48bb78' : props.type === 'negative' ? '#f56565' : '#e2e8f0'};
    font-weight: ${props => (props.type === 'positive' || props.type === 'negative') ? 'bold' : 'normal'};
`;

const ActionButton = styled.button`
    background: none;
    border: none;
    color: #a0aec0;
    cursor: pointer;
    margin-left: 0.5rem;
    transition: color 0.2s;

    &:hover {
        color: ${props => props.variant === 'delete' ? '#e53e3e' : '#63b3ed'};
    }
`;

// --- Main Component ---
const PortfolioPage = () => {
    const { portfolio, addHolding, updateHolding, deleteHolding, fetchPortfolio } = useAuth();

    const [newHolding, setNewHolding] = useState({
        symbol: '',
        quantity: '',
        purchasePrice: '',
        purchaseDate: ''
    });
    const [editingHoldingId, setEditingHoldingId] = useState(null);
    const [editFormData, setEditFormData] = useState({
        quantity: '',
        purchasePrice: '',
        purchaseDate: ''
    });
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    useEffect(() => {
        // Clear message after a few seconds
        if (message) {
            const timer = setTimeout(() => setMessage(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleNewHoldingChange = (e) => {
        setNewHolding({ ...newHolding, [e.target.name]: e.target.value });
    };

    const handleAddHoldingSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        // Basic validation
        if (!newHolding.symbol || !newHolding.quantity || !newHolding.purchasePrice) {
            setMessage('Please fill in all required fields: Symbol, Quantity, Purchase Price.');
            setMessageType('error');
            return;
        }
        if (isNaN(parseFloat(newHolding.quantity)) || parseFloat(newHolding.quantity) <= 0) {
            setMessage('Quantity must be a positive number.');
            setMessageType('error');
            return;
        }
        if (isNaN(parseFloat(newHolding.purchasePrice)) || parseFloat(newHolding.purchasePrice) <= 0) {
            setMessage('Purchase Price must be a positive number.');
            setMessageType('error');
            return;
        }

        const res = await addHolding({
            ...newHolding,
            symbol: newHolding.symbol.toUpperCase()
        });

        if (res.success) {
            setMessage(`'${newHolding.symbol.toUpperCase()}' added to portfolio!`);
            setMessageType('success');
            setNewHolding({ symbol: '', quantity: '', purchasePrice: '', purchaseDate: '' }); // Reset form
        } else {
            const errorMsg = res.errors ? res.errors.map(err => err.msg).join(', ') : res.msg;
            setMessage(`Error: ${errorMsg}`);
            setMessageType('error');
        }
    };

    const handleEditClick = (holding) => {
        setEditingHoldingId(holding._id);
        setEditFormData({
            quantity: holding.quantity,
            purchasePrice: holding.purchasePrice,
            purchaseDate: holding.purchaseDate ? new Date(holding.purchaseDate).toISOString().split('T')[0] : ''
        });
    };

    const handleEditFormChange = (e) => {
        setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    };

    const handleUpdateHolding = async (e, holdingId) => {
        e.preventDefault();
        setMessage('');

        // Basic validation for updates
        if (isNaN(parseFloat(editFormData.quantity)) || parseFloat(editFormData.quantity) <= 0) {
            setMessage('Quantity must be a positive number.');
            setMessageType('error');
            return;
        }
        if (isNaN(parseFloat(editFormData.purchasePrice)) || parseFloat(editFormData.purchasePrice) <= 0) {
            setMessage('Purchase Price must be a positive number.');
            setMessageType('error');
            return;
        }

        const res = await updateHolding(holdingId, editFormData);
        if (res.success) {
            setMessage('Holding updated successfully!');
            setMessageType('success');
            setEditingHoldingId(null); // Exit edit mode
        } else {
            const errorMsg = res.errors ? res.errors.map(err => err.msg).join(', ') : res.msg;
            setMessage(`Error updating holding: ${errorMsg}`);
            setMessageType('error');
        }
    };

    const handleDeleteHolding = async (holdingId) => {
        if (window.confirm('Are you sure you want to delete this holding?')) {
            setMessage('');
            const res = await deleteHolding(holdingId);
            if (res.success) {
                setMessage(res.msg || 'Holding deleted successfully!');
                setMessageType('success');
            } else {
                setMessage(`Error: ${res.msg}`);
                setMessageType('error');
            }
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatPercentage = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value / 100); // Divide by 100 because backend sends 5.5 for 5.5%
    };

    // Determine P&L type for styling
    const getPnLType = (value) => {
        if (value > 0) return 'positive';
        if (value < 0) return 'negative';
        return 'neutral';
    };


    return (
        <PageContainer>
            <Header>Your Investment Portfolio</Header>

            {message && <Message type={messageType}>{message}</Message>}

            <SectionTitle>Portfolio Summary</SectionTitle>
            <SummaryGrid>
                <SummaryCard>
                    <SummaryLabel>Total Portfolio Value</SummaryLabel>
                    <SummaryValue>{formatCurrency(portfolio.totalValue)}</SummaryValue>
                </SummaryCard>
                <SummaryCard>
                    <SummaryLabel>Total Profit/Loss</SummaryLabel>
                    <SummaryValue type={getPnLType(portfolio.totalProfitLoss)}>
                        {formatCurrency(portfolio.totalProfitLoss)}
                    </SummaryValue>
                </SummaryCard>
                <SummaryCard>
                    <SummaryLabel>Total P&L Percentage</SummaryLabel>
                    <SummaryValue type={getPnLType(portfolio.totalProfitLossPercentage)}>
                        {formatPercentage(portfolio.totalProfitLossPercentage)}
                    </SummaryValue>
                </SummaryCard>
            </SummaryGrid>

            <SectionTitle>Add New Holding</SectionTitle>
            <FormContainer>
                <AddHoldingForm onSubmit={handleAddHoldingSubmit}>
                    <FormGroup>
                        <Label htmlFor="symbol">Symbol</Label>
                        <Input
                            type="text"
                            id="symbol"
                            name="symbol"
                            placeholder="e.g., AAPL, BTC"
                            value={newHolding.symbol}
                            onChange={handleNewHoldingChange}
                            required
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                            type="number"
                            id="quantity"
                            name="quantity"
                            placeholder="e.g., 10"
                            step="0.0001"
                            value={newHolding.quantity}
                            onChange={handleNewHoldingChange}
                            required
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label htmlFor="purchasePrice">Purchase Price (per unit)</Label>
                        <Input
                            type="number"
                            id="purchasePrice"
                            name="purchasePrice"
                            placeholder="e.g., 175.50"
                            step="0.01"
                            value={newHolding.purchasePrice}
                            onChange={handleNewHoldingChange}
                            required
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label htmlFor="purchaseDate">Purchase Date (Optional)</Label>
                        <Input
                            type="date"
                            id="purchaseDate"
                            name="purchaseDate"
                            value={newHolding.purchaseDate}
                            onChange={handleNewHoldingChange}
                        />
                    </FormGroup>
                    <Button type="submit" style={{ '--button-span': 'full' }}>Add Holding</Button>
                </AddHoldingForm>
            </FormContainer>

            <SectionTitle>Your Holdings</SectionTitle>
            {portfolio.holdings && portfolio.holdings.length > 0 ? (
                <TableContainer>
                    <Table>
                        <thead>
                            <tr>
                                <Th>Symbol</Th>
                                <Th>Quantity</Th>
                                <Th>Purchase Price</Th>
                                <Th>Current Price</Th>
                                <Th>Current Value</Th>
                                <Th>P&L</Th>
                                <Th>P&L %</Th>
                                <Th>Purchase Date</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {portfolio.holdings.map((holding) => (
                                <tr key={holding._id}>
                                    {editingHoldingId === holding._id ? (
                                        // Edit row
                                        <>
                                            <Td>{holding.symbol}</Td>
                                            <Td>
                                                <Input
                                                    type="number"
                                                    name="quantity"
                                                    value={editFormData.quantity}
                                                    onChange={handleEditFormChange}
                                                    step="0.0001"
                                                    style={{ width: '80px', padding: '0.4rem' }}
                                                />
                                            </Td>
                                            <Td>
                                                <Input
                                                    type="number"
                                                    name="purchasePrice"
                                                    value={editFormData.purchasePrice}
                                                    onChange={handleEditFormChange}
                                                    step="0.01"
                                                    style={{ width: '80px', padding: '0.4rem' }}
                                                />
                                            </Td>
                                            <Td>{formatCurrency(holding.currentPrice)}</Td>
                                            <Td>{formatCurrency(holding.currentValue)}</Td>
                                            <TdValue type={getPnLType(holding.profitLoss)}>
                                                {formatCurrency(holding.profitLoss)}
                                            </TdValue>
                                            <TdValue type={getPnLType(holding.profitLossPercentage)}>
                                                {formatPercentage(holding.profitLossPercentage)}
                                            </TdValue>
                                            <Td>
                                                <Input
                                                    type="date"
                                                    name="purchaseDate"
                                                    value={editFormData.purchaseDate}
                                                    onChange={handleEditFormChange}
                                                    style={{ width: '120px', padding: '0.4rem' }}
                                                />
                                            </Td>
                                            <Td>
                                                <Button
                                                    onClick={(e) => handleUpdateHolding(e, holding._id)}
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    onClick={() => setEditingHoldingId(null)}
                                                    style={{ background: '#718096', marginLeft: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                                                >
                                                    Cancel
                                                </Button>
                                            </Td>
                                        </>
                                    ) : (
                                        // Display row
                                        <>
                                            <Td>{holding.symbol}</Td>
                                            <Td>{holding.quantity}</Td>
                                            <Td>{formatCurrency(holding.purchasePrice)}</Td>
                                            <Td>{formatCurrency(holding.currentPrice)}</Td>
                                            <Td>{formatCurrency(holding.currentValue)}</Td>
                                            <TdValue type={getPnLType(holding.profitLoss)}>
                                                {formatCurrency(holding.profitLoss)}
                                            </TdValue>
                                            <TdValue type={getPnLType(holding.profitLossPercentage)}>
                                                {formatPercentage(holding.profitLossPercentage)}
                                            </TdValue>
                                            <Td>{new Date(holding.purchaseDate).toLocaleDateString()}</Td>
                                            <Td>
                                                <ActionButton onClick={() => handleEditClick(holding)}>
                                                    <Edit size={18} />
                                                </ActionButton>
                                                <ActionButton variant="delete" onClick={() => handleDeleteHolding(holding._id)}>
                                                    <Trash2 size={18} />
                                                </ActionButton>
                                            </Td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </TableContainer>
            ) : (
                <p style={{ textAlign: 'center', color: '#a0aec0' }}>Your portfolio is currently empty. Add your first holding above!</p>
            )}
        </PageContainer>
    );
};

export default PortfolioPage;