import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  TrendingUp, 
  Layers, 
  Shield, 
  Plus, 
  Trash2, 
  Search, 
  PlusCircle, 
  X, 
  Save, 
  Edit, 
  LogOut,
  Sliders,
  DollarSign,
  Activity
} from 'lucide-react';

// Type Definitions
interface Fund {
  id: string;
  name: string;
  cnpj?: string;
  ticker?: string;
  class: string;
  subcategory: string;
  parent_group?: string;
  is_previdencia: boolean;
  is_qualified: boolean;
  is_closed: boolean;
  is_assessor: boolean;
  admin_fee: number;
  net_assets: number;
  sharpe: number;
  volatility: number;
  rentabilidade_12m: number;
  liquidity_days: string;
}

interface Portfolio {
  id: string;
  name: string;
  is_previdencia: boolean;
  total_investment: number;
}

interface Allocation {
  id?: string; // Optional if not yet saved to DB
  portfolio_id: string;
  fund_id: string;
  percentage: number;
  investment_value: number;
  fund?: Fund; // Linked fund details
  active?: boolean; // For checkbox tracking
}

interface FundHistory {
  id: string;
  fund_id: string;
  date: string;
  monthly_return: number;
  accumulated_return: number;
}

export default function App() {
  // Navigation State
  // Tabs: 'portfolio' (SuperCarteira), 'previdencia' (Previdência), 'comparator' (Comparador), 'edit_funds' (Cadastro/Edição), 'learn' (Aprenda)
  const [activeTab, setActiveTab] = useState<'portfolio' | 'previdencia' | 'comparator' | 'edit_funds' | 'learn'>('portfolio');

  // Database States
  const [funds, setFunds] = useState<Fund[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  
  // Loading & UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('All');
  
  // Comparator States
  const [comparatorSelectedFunds, setComparatorSelectedFunds] = useState<string[]>([]);
  const [comparePeriod, setComparePeriod] = useState<'1M' | '6M' | '1Y' | '5Y'>('1Y');
  const [compareBenchmarks, setCompareBenchmarks] = useState<string[]>(['CDI']);
  const [historyData, setHistoryData] = useState<FundHistory[]>([]);
  const [comparatorSearch, setComparatorSearch] = useState('');

  // Fund Registration / Editing Form State
  const [editingFundId, setEditingFundId] = useState<string | null>(null);
  const [fundForm, setFundForm] = useState({
    name: '',
    cnpj: '',
    ticker: '',
    class: 'Segurança',
    subcategory: 'Taxa Zero',
    parent_group: '',
    is_previdencia: false,
    is_qualified: false,
    is_closed: false,
    is_assessor: false,
    admin_fee: 0.0,
    net_assets: 0.0,
    sharpe: 0.0,
    volatility: 0.0,
    rentabilidade_12m: 0.0,
    liquidity_days: 'D+0'
  });

  // Modal / Add Asset State
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);

  // Initialize and load data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Sync portfolio selection with tab changes
  useEffect(() => {
    if (portfolios.length > 0) {
      const isPrev = activeTab === 'previdencia';
      const found = portfolios.find(p => p.is_previdencia === isPrev);
      if (found) {
        setSelectedPortfolio(found);
      }
    }
  }, [activeTab, portfolios]);

  // Load allocations whenever selected portfolio changes
  useEffect(() => {
    if (selectedPortfolio) {
      loadAllocations(selectedPortfolio.id);
    }
  }, [selectedPortfolio]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Fetch funds
      const { data: fundsData, error: fundsError } = await supabase
        .from('funds')
        .select('*')
        .order('name', { ascending: true });
        
      if (fundsError) throw fundsError;
      setFunds(fundsData || []);

      // Fetch portfolios
      const { data: portfoliosData, error: portfoliosError } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: true });
        
      if (portfoliosError) throw portfoliosError;
      setPortfolios(portfoliosData || []);

      // Fetch historical data for comparison
      const { data: historyDataRaw, error: historyError } = await supabase
        .from('fund_history')
        .select('*')
        .order('date', { ascending: true });
        
      if (historyError) throw historyError;
      setHistoryData(historyDataRaw || []);

    } catch (err) {
      console.error('Error loading initial data from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllocations = async (portfolioId: string) => {
    try {
      const { data, error } = await supabase
        .from('portfolio_allocations')
        .select(`
          id,
          portfolio_id,
          fund_id,
          percentage,
          investment_value
        `)
        .eq('portfolio_id', portfolioId);

      if (error) throw error;

      // Link funds to allocations
      const linkedAllocations: Allocation[] = (data || []).map(alloc => {
        const matchingFund = funds.find(f => f.id === alloc.fund_id);
        return {
          ...alloc,
          fund: matchingFund,
          active: alloc.percentage > 0
        };
      });

      setAllocations(linkedAllocations);
    } catch (err) {
      console.error('Error loading allocations:', err);
    }
  };

  // Rebalance percentages when sliders move or totals change
  const handleSliderChange = (allocationId: string | undefined, fundId: string, newValue: number) => {
    setAllocations(prev => {
      // Find matching item
      const updated = prev.map(item => {
        if ((item.id && item.id === allocationId) || item.fund_id === fundId) {
          const pct = Math.round(newValue * 100) / 100;
          return {
            ...item,
            percentage: pct,
            investment_value: selectedPortfolio ? Math.round((selectedPortfolio.total_investment * pct / 100) * 100) / 100 : 0
          };
        }
        return item;
      });

      // Normalize slider adjustments if needed to ensure total doesn't exceed 100% (optional, here we let user adjust freely and show warnings/totals)
      return updated;
    });
  };

  const handleInvestmentValueChange = (allocationId: string | undefined, fundId: string, newValue: number) => {
    setAllocations(prev => {
      return prev.map(item => {
        if ((item.id && item.id === allocationId) || item.fund_id === fundId) {
          const totalInv = selectedPortfolio ? selectedPortfolio.total_investment : 0;
          const pct = totalInv > 0 ? (newValue / totalInv) * 100 : 0;
          return {
            ...item,
            percentage: Math.round(pct * 100) / 100,
            investment_value: Math.round(newValue * 100) / 100
          };
        }
        return item;
      });
    });
  };

  const handleCheckboxChange = (allocationId: string | undefined, fundId: string, active: boolean) => {
    setAllocations(prev => {
      return prev.map(item => {
        if ((item.id && item.id === allocationId) || item.fund_id === fundId) {
          return {
            ...item,
            active,
            percentage: active ? 5.0 : 0.0, // default to 5% if re-enabled
            investment_value: active && selectedPortfolio ? Math.round((selectedPortfolio.total_investment * 0.05) * 100) / 100 : 0
          };
        }
        return item;
      });
    });
  };

  // Update total investment value in portfolio and allocations
  const handleTotalInvestmentChange = (val: number) => {
    if (!selectedPortfolio) return;
    
    const updatedPortfolio = {
      ...selectedPortfolio,
      total_investment: val
    };
    setSelectedPortfolio(updatedPortfolio);
    setPortfolios(prev => prev.map(p => p.id === selectedPortfolio.id ? updatedPortfolio : p));

    // Recalculate all allocations currency values
    setAllocations(prev => {
      return prev.map(item => ({
        ...item,
        investment_value: Math.round((val * item.percentage / 100) * 100) / 100
      }));
    });
  };

  // Save current rebalanced state to Supabase
  const handleSavePortfolio = async () => {
    if (!selectedPortfolio) return;
    try {
      setSaving(true);
      
      // Update portfolio total
      const { error: portfolioError } = await supabase
        .from('portfolios')
        .update({ total_investment: selectedPortfolio.total_investment })
        .eq('id', selectedPortfolio.id);

      if (portfolioError) throw portfolioError;

      // Update allocations: delete disabled ones, update/insert active ones
      for (const alloc of allocations) {
        if (alloc.id) {
          if (alloc.percentage === 0) {
            // Delete if percentage is 0
            await supabase.from('portfolio_allocations').delete().eq('id', alloc.id);
          } else {
            // Update
            await supabase.from('portfolio_allocations')
              .update({
                percentage: alloc.percentage,
                investment_value: alloc.investment_value
              })
              .eq('id', alloc.id);
          }
        } else if (alloc.percentage > 0) {
          // Insert new allocation
          await supabase.from('portfolio_allocations')
            .insert({
              portfolio_id: selectedPortfolio.id,
              fund_id: alloc.fund_id,
              percentage: alloc.percentage,
              investment_value: alloc.investment_value
            });
        }
      }

      alert('Carteira salva com sucesso !!!');
      loadAllocations(selectedPortfolio.id);
    } catch (err) {
      console.error('Error saving portfolio:', err);
      alert('Erro ao salvar carteira.');
    } finally {
      setSaving(false);
    }
  };

  // Add asset from Search Modal
  const handleAddAssetToPortfolio = (fund: Fund) => {
    if (!selectedPortfolio) return;

    // Check if already exists in allocations
    const exists = allocations.some(a => a.fund_id === fund.id);
    if (exists) {
      alert('Este fundo já está adicionado na carteira!');
      return;
    }

    const newAlloc: Allocation = {
      portfolio_id: selectedPortfolio.id,
      fund_id: fund.id,
      percentage: 5.0, // Default allocation 5%
      investment_value: selectedPortfolio.total_investment * 0.05,
      fund: fund,
      active: true
    };

    setAllocations(prev => [...prev, newAlloc]);
    setShowAddAssetModal(false);
  };

  // Remove asset from portfolio
  const handleRemoveAsset = (fundId: string) => {
    setAllocations(prev => prev.filter(a => a.fund_id !== fundId));
  };

  // Submit Register/Edit Fund form
  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      const payload = {
        name: fundForm.name,
        cnpj: fundForm.cnpj || null,
        ticker: fundForm.ticker || null,
        class: fundForm.class,
        subcategory: fundForm.subcategory,
        parent_group: fundForm.parent_group || null,
        is_previdencia: fundForm.is_previdencia,
        is_qualified: fundForm.is_qualified,
        is_closed: fundForm.is_closed,
        is_assessor: fundForm.is_assessor,
        admin_fee: fundForm.admin_fee,
        net_assets: fundForm.net_assets,
        sharpe: fundForm.sharpe,
        volatility: fundForm.volatility,
        rentabilidade_12m: fundForm.rentabilidade_12m,
        liquidity_days: fundForm.liquidity_days
      };

      if (editingFundId) {
        // Edit mode
        const { error } = await supabase
          .from('funds')
          .update(payload)
          .eq('id', editingFundId);

        if (error) throw error;
        alert('Fundo atualizado com sucesso no Supabase!');
      } else {
        // Create mode
        const { error } = await supabase
          .from('funds')
          .insert(payload);

        if (error) throw error;
        alert('Fundo cadastrado com sucesso no Supabase!');
      }

      // Reset form and reload
      setFundForm({
        name: '',
        cnpj: '',
        ticker: '',
        class: 'Segurança',
        subcategory: 'Taxa Zero',
        parent_group: '',
        is_previdencia: false,
        is_qualified: false,
        is_closed: false,
        is_assessor: false,
        admin_fee: 0.0,
        net_assets: 0.0,
        sharpe: 0.0,
        volatility: 0.0,
        rentabilidade_12m: 0.0,
        liquidity_days: 'D+0'
      });
      setEditingFundId(null);
      loadInitialData();
    } catch (err) {
      console.error('Error saving fund:', err);
      alert('Erro ao salvar o fundo.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFund = (fund: Fund) => {
    setEditingFundId(fund.id);
    setFundForm({
      name: fund.name,
      cnpj: fund.cnpj || '',
      ticker: fund.ticker || '',
      class: fund.class,
      subcategory: fund.subcategory,
      parent_group: fund.parent_group || '',
      is_previdencia: fund.is_previdencia,
      is_qualified: fund.is_qualified,
      is_closed: fund.is_closed,
      is_assessor: fund.is_assessor,
      admin_fee: fund.admin_fee,
      net_assets: fund.net_assets,
      sharpe: fund.sharpe,
      volatility: fund.volatility,
      rentabilidade_12m: fund.rentabilidade_12m,
      liquidity_days: fund.liquidity_days
    });
  };

  // Calculations for allocations totals
  const totalAllocationPct = allocations.reduce((acc, curr) => acc + (curr.active ? curr.percentage : 0), 0);
  const remainingPct = 100 - totalAllocationPct;

  // Group allocations by Class
  const groupedAllocations = allocations.reduce((acc, curr) => {
    if (!curr.fund) return acc;
    const cls = curr.fund.class;
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(curr);
    return acc;
  }, {} as Record<string, Allocation[]>);

  // Group allocations by Liquidity Terms for charts
  const groupedLiquidity = allocations.reduce((acc, curr) => {
    if (!curr.fund || !curr.active) return acc;
    const term = curr.fund.liquidity_days || 'D+0';
    acc[term] = (acc[term] || 0) + curr.investment_value;
    return acc;
  }, {} as Record<string, number>);

  // Render SVG Donut Chart percentages
  const getDonutData = () => {
    const classes = ['Segurança', 'Estabilidade', 'Diversificação', 'Valorização', 'Antifragilidade', 'Satélite'];
    const colors = {
      'Segurança': 'var(--primary-color)',
      'Estabilidade': 'var(--color-estabilidade)',
      'Diversificação': 'var(--color-diversificacao)',
      'Valorização': 'var(--color-valorizacao)',
      'Antifragilidade': 'var(--color-antifragilidade)',
      'Satélite': 'var(--color-satelite)'
    };
    
    const classTotals = classes.reduce((acc, cls) => {
      const total = allocations
        .filter(a => a.active && a.fund && a.fund.class === cls)
        .reduce((sum, curr) => sum + curr.percentage, 0);
      acc[cls] = total;
      return acc;
    }, {} as Record<string, number>);

    return classes.map(cls => ({
      name: cls,
      value: classTotals[cls] || 0,
      color: colors[cls as keyof typeof colors]
    })).filter(item => item.value > 0);
  };

  const donutSegments = getDonutData();
  const totalDonutValue = donutSegments.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate SVG dasharrays for donut
  let accumulatedPercent = 0;

  // Helper to get real history from DB, or fallback to synthetic history based on fund metrics
  const getFundHistory = (fundId: string) => {
    const dbHistory = historyData.filter(h => h.fund_id === fundId);
    if (dbHistory.length > 0) return dbHistory;

    // Generate synthetic history based on fund metrics
    const fund = funds.find(f => f.id === fundId);
    if (!fund) return [];

    const dates = [
      '2025-05-01', '2025-06-01', '2025-07-01', '2025-08-01', '2025-09-01',
      '2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01',
      '2026-03-01', '2026-04-01', '2026-05-01'
    ];

    const annualReturn = fund.rentabilidade_12m || 10.5;
    const monthlyRate = Math.pow(1 + annualReturn / 100, 1/12) - 1;
    const vol = fund.volatility || 4.5;

    let accum = 100;
    return dates.map((date, idx) => {
      if (idx === 0) {
        return { id: '', fund_id: fundId, date, monthly_return: 0, accumulated_return: 100 };
      }
      // Add realistic random-looking variation
      const variation = (Math.sin(idx * 1.5) * (vol / 4)) + (Math.cos(idx * 2.8) * (vol / 6));
      const monthReturn = (monthlyRate * 100) + variation;
      accum = accum * (1 + monthReturn / 100);
      return {
        id: '',
        fund_id: fundId,
        date,
        monthly_return: monthReturn,
        accumulated_return: accum
      };
    });
  };

  // Calculate dynamic portfolio history based on active allocations
  const getPortfolioHistory = () => {
    const dates = [
      '2025-05-01', '2025-06-01', '2025-07-01', '2025-08-01', '2025-09-01',
      '2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01',
      '2026-03-01', '2026-04-01', '2026-05-01'
    ];

    const activeAllocations = allocations.filter(a => a.active && a.percentage > 0);
    if (activeAllocations.length === 0) {
      return dates.map(date => ({ date, accumulated_return: 100 }));
    }

    const allocationsHistories = activeAllocations.map(alloc => ({
      percentage: alloc.percentage,
      history: getFundHistory(alloc.fund_id)
    }));

    return dates.map((date) => {
      let weightedAccum = 0;
      let totalWeight = 0;

      allocationsHistories.forEach(ah => {
        const point = ah.history.find(p => p.date === date);
        if (point) {
          weightedAccum += Number(point.accumulated_return) * ah.percentage;
          totalWeight += ah.percentage;
        }
      });

      const finalAccum = totalWeight > 0 ? (weightedAccum / totalWeight) : 100;
      return {
        date,
        accumulated_return: finalAccum
      };
    });
  };

  const getCompareChartPath = (fundId: string) => {
    const fundHistory = getFundHistory(fundId);
    if (fundHistory.length === 0) return '';

    const pointsCount = fundHistory.length;
    const stepX = 750 / (pointsCount - 1 || 1);
    
    const allReturns = fundHistory.map(h => Number(h.accumulated_return));
    const minVal = 90;
    const maxVal = Math.max(...allReturns, 120);
    const range = maxVal - minVal;

    return fundHistory.map((h, i) => {
      const x = 25 + i * stepX;
      const y = 280 - ((Number(h.accumulated_return) - minVal) / range) * 240;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // Helper colors for compare chart lines
  const compareColors = [
    '#2563eb', // Blue
    '#dc2626', // Red
    '#16a34a', // Green
    '#d97706', // Yellow
    '#7c3aed', // Purple
    '#db2777', // Pink
    '#0d9488', // Teal
  ];

  // Render portfolio and CDI curves dynamically for portfolio tab
  const portfolioHistory = getPortfolioHistory();
  const cdiFundId = funds.find(f => f.name === 'CDI')?.id;
  const cdiHistory = cdiFundId ? getFundHistory(cdiFundId) : [];

  // Find min and max for scaling
  const allValues = [
    ...portfolioHistory.map(p => p.accumulated_return),
    ...(cdiHistory.map(c => Number(c.accumulated_return)))
  ];
  
  const minChartVal = allValues.length > 0 ? Math.min(...allValues, 100) - 2 : 95;
  const maxChartVal = allValues.length > 0 ? Math.max(...allValues, 110) + 2 : 120;
  const chartRange = maxChartVal - minChartVal;

  const getPortfolioChartPath = () => {
    const stepX = 750 / 12; // 13 points, 12 steps
    return portfolioHistory.map((p, i) => {
      const x = 25 + i * stepX;
      const y = 280 - ((p.accumulated_return - minChartVal) / (chartRange || 1)) * 240;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const getCdiChartPath = () => {
    if (cdiHistory.length === 0) return '';
    const stepX = 750 / 12;
    return cdiHistory.map((c, i) => {
      const x = 25 + i * stepX;
      const y = 280 - ((Number(c.accumulated_return) - minChartVal) / (chartRange || 1)) * 240;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  return (
    <div className="app-container">
      {/* HEADER / NAVIGATION */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">C</div>
          <div className="logo-text">Minha<span>Carteira</span></div>
        </div>

        <nav className="app-nav">
          <div 
            onClick={() => setActiveTab('portfolio')} 
            className={`nav-link ${activeTab === 'portfolio' ? 'active' : ''}`}
          >
            Minha Carteira
          </div>
          <div 
            onClick={() => setActiveTab('previdencia')} 
            className={`nav-link ${activeTab === 'previdencia' ? 'active' : ''}`}
          >
            Veja sua Previdência
          </div>
          <div 
            onClick={() => setActiveTab('comparator')} 
            className={`nav-link ${activeTab === 'comparator' ? 'active' : ''}`}
          >
            Comparador de Ativos
          </div>
          <div 
            onClick={() => setActiveTab('edit_funds')} 
            className={`nav-link ${activeTab === 'edit_funds' ? 'active' : ''}`}
          >
            Gerenciar Fundos
          </div>
          <div 
            onClick={() => setActiveTab('learn')} 
            className={`nav-link ${activeTab === 'learn' ? 'active' : ''}`}
          >
            Aprenda a Usar
          </div>
        </nav>

        <div className="header-actions">
          <button className="btn-logout" onClick={() => alert('Logout simulado')}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="app-main">
        {/* SIDEBAR - Shown on Portfolio and Previdência Tabs */}
        {(activeTab === 'portfolio' || activeTab === 'previdencia') && (
          <aside className="app-sidebar">
            <div className="portfolio-selector">
              <span>{selectedPortfolio?.name || (activeTab === 'portfolio' ? 'Minha Carteira 1' : 'Minha Previdência')}</span>
              <Sliders size={18} />
            </div>

            {/* DONUT CHART */}
            <div className="allocation-donut-container">
              <div className="donut-svg-wrapper">
                <svg viewBox="0 0 42 42" className="chart-svg-element">
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4"></circle>
                  {donutSegments.map((segment) => {
                    const segmentPercent = segment.value;
                    const strokeDash = `${segmentPercent} ${100 - segmentPercent}`;
                    const strokeOffset = 100 - accumulatedPercent + 25;
                    accumulatedPercent += segmentPercent;

                    return (
                      <circle
                        key={segment.name}
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke={segment.color}
                        strokeWidth="4.2"
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                        className="donut-segment"
                      />
                    );
                  })}
                </svg>
                <div className="donut-center-text">
                  <div className="title">Investido</div>
                  <div className="value">
                    R$ {(selectedPortfolio?.total_investment || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* LEGEND */}
            <div className="sidebar-legend">
              <div className="form-label" style={{ marginBottom: 4 }}>Alocação Atual</div>
              {donutSegments.map(segment => (
                <div className="legend-item" key={segment.name}>
                  <div className="legend-label-group">
                    <div className="legend-color-dot" style={{ backgroundColor: segment.color }}></div>
                    <span className="legend-name">{segment.name}</span>
                  </div>
                  <span className="legend-percentage">{segment.value.toFixed(1)}%</span>
                </div>
              ))}
              {totalDonutValue === 0 && (
                <div className="selected-list-empty" style={{ padding: '8px 0' }}>
                  Nenhum ativo alocado
                </div>
              )}
            </div>

            {/* VALOR DE INVESTIMENTO */}
            <div className="sidebar-form">
              <div className="form-group">
                <label className="form-label">Valor de Investimento</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-muted)' }}>R$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input-control"
                    style={{ paddingLeft: 36, width: '100%' }}
                    value={selectedPortfolio?.total_investment || ''}
                    onChange={(e) => handleTotalInvestmentChange(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="legend-item" style={{ fontSize: 13, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <span className="legend-name">Restante a Alocar:</span>
                <span className="legend-percentage" style={{ color: remainingPct < 0 ? '#ef4444' : remainingPct > 0 ? '#3b82f6' : '#10b981' }}>
                  {remainingPct.toFixed(1)}% (R$ {((selectedPortfolio?.total_investment || 0) * remainingPct / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                </span>
              </div>

              {/* SAVE & ADD ACTIONS */}
              <button className="btn-save-portfolio" onClick={handleSavePortfolio} disabled={saving}>
                <Save size={16} style={{ marginRight: 6 }} />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>

              <button className="btn-sidebar-action" onClick={() => setShowAddAssetModal(true)}>
                <Plus size={16} />
                Adicionar ativo
              </button>
            </div>
          </aside>
        )}

        {/* CONTENT PANELS */}
        <section className="app-content">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Activity className="animate-spin" size={48} style={{ color: 'var(--primary-color)', animation: 'spin 1.5s linear infinite' }} />
              <p style={{ marginTop: 16, fontSize: 16, color: 'var(--text-muted)', fontWeight: 500 }}>Carregando dados da carteira do Supabase...</p>
            </div>
          ) : (
            <>
              {/* TAB 1 & 2: PORTFOLIOS */}
              {(activeTab === 'portfolio' || activeTab === 'previdencia') && selectedPortfolio && (
                <div className="dashboard-grid">
                  <div className="dashboard-header">
                    <div className="dashboard-title-group">
                      <div className="subtitle">{allocations.filter(a => a.active).length} ativos selecionados</div>
                      <div className="title">{activeTab === 'portfolio' ? 'Minha Carteira' : 'Minha Previdência'}</div>
                    </div>
                  </div>

                  {/* CARDS GRID GROUPED BY ASSET CLASS */}
                  {Object.keys(groupedAllocations).length === 0 ? (
                    <div className="learn-card" style={{ alignItems: 'center', justifyContent: 'center', padding: 48, borderStyle: 'dashed' }}>
                      <Layers size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
                      <h3 style={{ fontSize: 18, fontWeight: 700 }}>Sua carteira está vazia</h3>
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: 400, marginTop: 4 }}>
                        Utilize o botão <strong>"+ Adicionar ativo"</strong> no painel lateral esquerdo para selecionar fundos e montar sua carteira.
                      </p>
                    </div>
                  ) : (
                    Object.keys(groupedAllocations).map(cls => (
                      <div key={cls} className={`asset-class-section class-${cls.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>
                        <div className="class-section-header">{cls}</div>
                        <div className="cards-grid">
                          {groupedAllocations[cls].map(alloc => (
                            <div key={alloc.fund_id} className="asset-card">
                              <div className="asset-card-header">
                                <div style={{ flex: 1 }}>
                                  <h4 className="asset-card-title" title={alloc.fund?.name}>{alloc.fund?.name}</h4>
                                  <div className="asset-card-subcategory">{alloc.fund?.subcategory}</div>
                                </div>
                                <input
                                  type="checkbox"
                                  className="asset-card-checkbox"
                                  checked={alloc.active}
                                  onChange={(e) => handleCheckboxChange(alloc.id, alloc.fund_id, e.target.checked)}
                                />
                              </div>

                              <div className="asset-card-metrics">
                                <div className="metric-box">
                                  <span className="metric-label">% da Carteira</span>
                                  <span className="metric-value">{alloc.percentage.toFixed(1)}%</span>
                                </div>
                                <div className="metric-box">
                                   <span className="metric-label">Investimento</span>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                     <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>R$</span>
                                     <input
                                       type="number"
                                       step="0.01"
                                       style={{
                                         border: 'none',
                                         borderBottom: '1.5px dashed var(--border-color)',
                                         fontWeight: 700,
                                         fontSize: '14px',
                                         width: '90px',
                                         color: 'var(--text-main)',
                                         background: 'transparent',
                                         outline: 'none',
                                         padding: '0'
                                       }}
                                       value={alloc.active ? alloc.investment_value : 0}
                                       disabled={!alloc.active}
                                       onChange={(e) => handleInvestmentValueChange(alloc.id, alloc.fund_id, Number(e.target.value))}
                                     />
                                   </div>
                                 </div>
                              </div>

                              <div className="slider-container">
                                <input
                                  type="range"
                                  className="range-slider"
                                  min="0"
                                  max="50"
                                  step="0.5"
                                  value={alloc.active ? alloc.percentage : 0}
                                  disabled={!alloc.active}
                                  onChange={(e) => handleSliderChange(alloc.id, alloc.fund_id, Number(e.target.value))}
                                />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                                <span>Volatilidade: {alloc.fund?.volatility || 0}%</span>
                                <span>Sharpe: {alloc.fund?.sharpe || 0}</span>
                                <span>Liquidez: {alloc.fund?.liquidity_days || 'D+0'}</span>
                                <button 
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                  onClick={() => handleRemoveAsset(alloc.fund_id)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}

                  {/* VISUAL CHARTS SECTION */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 12 }}>
                    {/* Performance Line Chart */}
                    <div className="chart-card-wrapper">
                      <div className="chart-card-title">
                        <span>Histórico de Rentabilidade</span>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 3, backgroundColor: 'var(--primary-color)', display: 'inline-block' }}></span>
                            Sua Carteira
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 3, backgroundColor: 'var(--color-diversificacao)', display: 'inline-block' }}></span>
                            CDI
                          </span>
                        </div>
                      </div>
                      <div className="svg-chart-container">
                        <svg viewBox="0 0 800 300" className="chart-svg-element" style={{ overflow: 'visible' }}>
                          {/* Grid Lines */}
                          <line x1="25" y1="40" x2="780" y2="40" stroke="#f1f5f9" strokeWidth="1" />
                          <line x1="25" y1="100" x2="780" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                          <line x1="25" y1="160" x2="780" y2="160" stroke="#f1f5f9" strokeWidth="1" />
                          <line x1="25" y1="220" x2="780" y2="220" stroke="#f1f5f9" strokeWidth="1" />
                          <line x1="25" y1="280" x2="780" y2="280" stroke="#cbd5e1" strokeWidth="1.5" />
                          
                          {/* Y-axis Labels */}
                          <text x="5" y="44" fill="var(--text-light)" fontSize="10" fontWeight="600">{(maxChartVal).toFixed(1)}%</text>
                          <text x="5" y="104" fill="var(--text-light)" fontSize="10" fontWeight="600">{(maxChartVal - chartRange * 0.25).toFixed(1)}%</text>
                          <text x="5" y="164" fill="var(--text-light)" fontSize="10" fontWeight="600">{(maxChartVal - chartRange * 0.5).toFixed(1)}%</text>
                          <text x="5" y="224" fill="var(--text-light)" fontSize="10" fontWeight="600">{(maxChartVal - chartRange * 0.75).toFixed(1)}%</text>
                          <text x="5" y="284" fill="var(--text-light)" fontSize="10" fontWeight="600">{(minChartVal).toFixed(1)}%</text>

                          {/* X-axis Labels */}
                          <text x="25" y="296" fill="var(--text-light)" fontSize="9" fontWeight="600" textAnchor="middle">Mai 25</text>
                          <text x="150" y="296" fill="var(--text-light)" fontSize="9" fontWeight="600" textAnchor="middle">Ago 25</text>
                          <text x="275" y="296" fill="var(--text-light)" fontSize="9" fontWeight="600" textAnchor="middle">Nov 25</text>
                          <text x="400" y="296" fill="var(--text-light)" fontSize="9" fontWeight="600" textAnchor="middle">Fev 26</text>
                          <text x="525" y="296" fill="var(--text-light)" fontSize="9" fontWeight="600" textAnchor="middle">Mai 26</text>

                          {/* Benchmark Line (CDI) */}
                          <path
                            d={getCdiChartPath()}
                            fill="none"
                            stroke="var(--color-diversificacao)"
                            strokeWidth="2.5"
                          />

                          {/* Portfolio Performance (Simulated outperformance based on allocations) */}
                          <path
                            d={getPortfolioChartPath()}
                            fill="none"
                            stroke="var(--primary-color)"
                            strokeWidth="3.5"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Liquidity Bar Chart */}
                    <div className="chart-card-wrapper">
                      <div className="chart-card-title">Liquidez da Carteira (Valor por Prazo)</div>
                      <div className="svg-chart-container" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 24 }}>
                        {Object.keys(groupedLiquidity).length === 0 ? (
                          <div style={{ color: 'var(--text-light)', fontSize: 13 }}>Nenhum ativo para calcular liquidez</div>
                        ) : (
                          Object.keys(groupedLiquidity).map(term => {
                            const val = groupedLiquidity[term];
                            const maxVal = Math.max(...Object.values(groupedLiquidity), 1);
                            const heightPct = (val / maxVal) * 200;

                            return (
                              <div key={term} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)' }}>
                                  R$ {val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                </div>
                                <div
                                  style={{
                                    width: 32,
                                    height: heightPct,
                                    backgroundColor: 'var(--color-valorizacao)',
                                    borderRadius: '4px 4px 0 0',
                                    transition: 'height 0.3s ease'
                                  }}
                                />
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                                  {term}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COMPARATOR */}
              {activeTab === 'comparator' && (
                <div className="compare-container">
                  <div className="compare-header-row">
                    <div className="dashboard-title-group">
                      <div className="subtitle">Pesquise e selecione ativos para avaliar e comparar retornos históricos</div>
                      <div className="title">Comparador de Ativos</div>
                    </div>

                    <div className="compare-search-controls">
                      {/* Search & Selector */}
                      <div className="search-bar-wrapper">
                        <Search className="search-icon-inside" size={18} />
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Pesquise fundos pelo nome ou ticker..."
                          value={comparatorSearch}
                          onChange={(e) => setComparatorSearch(e.target.value)}
                        />
                      </div>

                      {/* Benchmarks Selector */}
                      <div className="benchmark-selector-group">
                        {['CDI', 'IBOV', 'Dólar'].map(bench => (
                          <button
                            key={bench}
                            className={`btn-benchmark-chip ${compareBenchmarks.includes(bench) ? 'active' : ''}`}
                            onClick={() => {
                              setCompareBenchmarks(prev => 
                                prev.includes(bench) ? prev.filter(b => b !== bench) : [...prev, bench]
                              );
                            }}
                          >
                            {bench}
                          </button>
                        ))}
                      </div>

                      {/* Period tabs */}
                      <div className="period-selector-group">
                        {(['1M', '6M', '1Y', '5Y'] as const).map(p => (
                          <button
                            key={p}
                            className={`btn-period-tab ${comparePeriod === p ? 'active' : ''}`}
                            onClick={() => setComparePeriod(p)}
                          >
                            {p === '1M' ? 'Mês' : p === '6M' ? '6 Meses' : p === '1Y' ? '1 Ano' : '5 Anos'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Chart Comparison Panel */}
                  <div className="chart-card-wrapper">
                    <div className="chart-card-title">
                      <span>Comparação de Rentabilidade - Acumulado (%)</span>
                      <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Base: 100pt</span>
                    </div>

                    <div className="svg-chart-container">
                      <svg viewBox="0 0 800 300" className="chart-svg-element" style={{ overflow: 'visible' }}>
                        {/* Grid lines */}
                        <line x1="25" y1="40" x2="780" y2="40" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="25" y1="100" x2="780" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="25" y1="160" x2="780" y2="160" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="25" y1="220" x2="780" y2="220" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="25" y1="280" x2="780" y2="280" stroke="#cbd5e1" strokeWidth="1.5" />

                        {/* Chart lines */}
                        {/* Render active benchmarks */}
                        {compareBenchmarks.map((bench, idx) => {
                          const matchingBenchFund = funds.find(f => f.name === bench);
                          if (!matchingBenchFund) return null;
                          return (
                            <path
                              key={bench}
                              d={getCompareChartPath(matchingBenchFund.id)}
                              fill="none"
                              stroke={compareColors[idx % compareColors.length]}
                              strokeWidth="2"
                              strokeDasharray="4,4"
                            />
                          );
                        })}

                        {/* Render selected funds */}
                        {comparatorSelectedFunds.map((fundId, idx) => (
                          <path
                            key={fundId}
                            d={getCompareChartPath(fundId)}
                            fill="none"
                            stroke={compareColors[(idx + compareBenchmarks.length) % compareColors.length]}
                            strokeWidth="3.5"
                          />
                        ))}

                        <text x="30" y="296" fill="var(--text-light)" fontSize="10">Mai 25</text>
                        <text x="400" y="296" fill="var(--text-light)" fontSize="10" textAnchor="middle">Nov 25</text>
                        <text x="760" y="296" fill="var(--text-light)" fontSize="10" textAnchor="end">Mai 26</text>
                      </svg>
                    </div>

                    {/* Chart Legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
                      {compareBenchmarks.map((bench, idx) => (
                        <span key={bench} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                          <span style={{ width: 12, height: 3, borderTop: '2px dashed ' + compareColors[idx % compareColors.length] }}></span>
                          {bench}
                        </span>
                      ))}
                      {comparatorSelectedFunds.map((fundId, idx) => {
                        const fund = funds.find(f => f.id === fundId);
                        return (
                          <span key={fundId} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                            <span style={{ width: 12, height: 3, backgroundColor: compareColors[(idx + compareBenchmarks.length) % compareColors.length] }}></span>
                            {fund?.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comparator Table Grid */}
                  <div className="comparison-table-wrapper">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>Ativo</th>
                          <th>Classe</th>
                          <th>Rentabilidade 12M</th>
                          <th>Volatilidade</th>
                          <th>Sharpe</th>
                          <th>Taxa Admin</th>
                          <th>PL (Milhões)</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {funds
                          .filter(f => 
                            f.class !== 'Benchmark' &&
                            (f.name.toLowerCase().includes(comparatorSearch.toLowerCase()) || 
                             (f.ticker && f.ticker.toLowerCase().includes(comparatorSearch.toLowerCase())))
                          )
                          .slice(0, 10)
                          .map(fund => {
                            const isCompared = comparatorSelectedFunds.includes(fund.id);
                            return (
                              <tr key={fund.id}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{fund.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CNPJ: {fund.cnpj || 'N/A'}</div>
                                </td>
                                <td>{fund.class}</td>
                                <td style={{ color: '#10b981', fontWeight: 700 }}>{fund.rentabilidade_12m.toFixed(1)}%</td>
                                <td>{fund.volatility.toFixed(1)}%</td>
                                <td>{fund.sharpe.toFixed(2)}</td>
                                <td>{fund.admin_fee.toFixed(2)}%</td>
                                <td>R$ {fund.net_assets.toLocaleString('pt-BR')}M</td>
                                <td>
                                  <button
                                    onClick={() => {
                                      setComparatorSelectedFunds(prev =>
                                        isCompared ? prev.filter(id => id !== fund.id) : [...prev, fund.id]
                                      );
                                    }}
                                    className="btn-add-fund-trigger"
                                    style={{
                                      backgroundColor: isCompared ? '#fee2e2' : '#eff6ff',
                                      borderColor: isCompared ? '#ef4444' : 'var(--primary-color)',
                                      color: isCompared ? '#ef4444' : 'var(--primary-color)'
                                    }}
                                  >
                                    {isCompared ? 'Remover' : 'Comparar'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: REGISTER & EDIT FUNDS */}
              {activeTab === 'edit_funds' && (
                <div className="compare-container">
                  <div className="dashboard-header">
                    <div className="dashboard-title-group">
                      <div className="subtitle">Gerencie o banco de dados de fundos integrados ao Supabase</div>
                      <div className="title">{editingFundId ? 'Editar Fundo Existente' : 'Cadastrar Novo Fundo'}</div>
                    </div>
                  </div>

                  <div className="admin-card-layout">
                    <form onSubmit={handleFundSubmit} className="admin-form">
                      <div className="form-group admin-form-full">
                        <label className="form-label">Nome Completo do Fundo</label>
                        <input
                          type="text"
                          className="input-control"
                          required
                          value={fundForm.name}
                          onChange={(e) => setFundForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">CNPJ (Opcional)</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="00.000.000/0000-00"
                          value={fundForm.cnpj}
                          onChange={(e) => setFundForm(prev => ({ ...prev, cnpj: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Ticker / Código (Opcional)</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="Ex: IVVB11"
                          value={fundForm.ticker}
                          onChange={(e) => setFundForm(prev => ({ ...prev, ticker: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Classe do Ativo</label>
                        <select
                          className="input-control"
                          value={fundForm.class}
                          onChange={(e) => setFundForm(prev => ({ ...prev, class: e.target.value }))}
                        >
                          <option value="Segurança">Segurança</option>
                          <option value="Estabilidade">Estabilidade</option>
                          <option value="Diversificação">Diversificação</option>
                          <option value="Valorização">Valorização</option>
                          <option value="Antifragilidade">Antifragilidade</option>
                          <option value="Satélite">Satélite</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Subcategoria</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="Ex: Taxa Zero, Baunilha, Pimentinha"
                          value={fundForm.subcategory}
                          onChange={(e) => setFundForm(prev => ({ ...prev, subcategory: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Grupo / Família de Fundo (Opcional)</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="Ex: Augme 30"
                          value={fundForm.parent_group}
                          onChange={(e) => setFundForm(prev => ({ ...prev, parent_group: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Prazo de Resgate (Dias)</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="Ex: D+0, D+30, D+90"
                          value={fundForm.liquidity_days}
                          onChange={(e) => setFundForm(prev => ({ ...prev, liquidity_days: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Taxa de Administração (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-control"
                          value={fundForm.admin_fee}
                          onChange={(e) => setFundForm(prev => ({ ...prev, admin_fee: Number(e.target.value) }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Patrimônio Líquido (PL em Milhões)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="input-control"
                          value={fundForm.net_assets}
                          onChange={(e) => setFundForm(prev => ({ ...prev, net_assets: Number(e.target.value) }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Índice Sharpe</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-control"
                          value={fundForm.sharpe}
                          onChange={(e) => setFundForm(prev => ({ ...prev, sharpe: Number(e.target.value) }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Volatilidade 12M (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="input-control"
                          value={fundForm.volatility}
                          onChange={(e) => setFundForm(prev => ({ ...prev, volatility: Number(e.target.value) }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Rentabilidade 12M (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="input-control"
                          value={fundForm.rentabilidade_12m}
                          onChange={(e) => setFundForm(prev => ({ ...prev, rentabilidade_12m: Number(e.target.value) }))}
                        />
                      </div>

                      {/* Flags */}
                      <div className="form-group admin-form-full" style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap', marginTop: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={fundForm.is_previdencia}
                            onChange={(e) => setFundForm(prev => ({ ...prev, is_previdencia: e.target.checked }))}
                          />
                          Fundo de Previdência
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={fundForm.is_qualified}
                            onChange={(e) => setFundForm(prev => ({ ...prev, is_qualified: e.target.checked }))}
                          />
                          Investidor Qualificado (Q)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={fundForm.is_closed}
                            onChange={(e) => setFundForm(prev => ({ ...prev, is_closed: e.target.checked }))}
                          />
                          Fundo Fechado
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={fundForm.is_assessor}
                            onChange={(e) => setFundForm(prev => ({ ...prev, is_assessor: e.target.checked }))}
                          />
                          Exclusivo Assessor
                        </label>
                      </div>

                      <button type="submit" className="btn-admin-submit" disabled={saving}>
                        <PlusCircle size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        {saving ? 'Gravando...' : editingFundId ? 'Atualizar Fundo' : 'Cadastrar Fundo'}
                      </button>

                      {editingFundId && (
                        <button
                          type="button"
                          className="btn-admin-submit"
                          style={{ backgroundColor: 'var(--text-light)', gridColumn: 'auto' }}
                          onClick={() => {
                            setEditingFundId(null);
                            setFundForm({
                              name: '', cnpj: '', ticker: '', class: 'Segurança', subcategory: 'Taxa Zero',
                              parent_group: '', is_previdencia: false, is_qualified: false, is_closed: false,
                              is_assessor: false, admin_fee: 0.0, net_assets: 0.0, sharpe: 0.0, volatility: 0.0,
                              rentabilidade_12m: 0.0, liquidity_days: 'D+0'
                            });
                          }}
                        >
                          Cancelar Edição
                        </button>
                      )}
                    </form>
                  </div>

                  {/* Fund registry list */}
                  <div className="comparison-table-wrapper" style={{ marginTop: 32 }}>
                    <div style={{ padding: '16px 20px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', fontSize: 15 }}>
                      Lista de Fundos Cadastrados ({funds.filter(f => f.class !== 'Benchmark').length})
                    </div>
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Classe</th>
                          <th>CNPJ/Ticker</th>
                          <th>Previdência</th>
                          <th>Taxas & Liquidez</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {funds
                          .filter(f => f.class !== 'Benchmark')
                          .map(fund => (
                            <tr key={fund.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{fund.name}</div>
                              </td>
                              <td>{fund.class}</td>
                              <td>{fund.cnpj || fund.ticker || 'N/A'}</td>
                              <td>{fund.is_previdencia ? 'Sim' : 'Não'}</td>
                              <td>{fund.admin_fee}% | {fund.liquidity_days}</td>
                              <td>
                                <button className="btn-logout" style={{ color: 'var(--primary-color)' }} onClick={() => handleEditFund(fund)}>
                                  <Edit size={14} />
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: LEARN TO USE */}
              {activeTab === 'learn' && (
                <div className="compare-container">
                  <div className="dashboard-header">
                    <div className="dashboard-title-group">
                      <div className="subtitle">Entenda a filosofia de alocação das cinco classes fundamentais</div>
                      <div className="title">Aprenda a Usar</div>
                    </div>
                  </div>

                  <div className="learn-grid">
                    <div className="learn-card" style={{ borderTop: '4px solid var(--primary-color)' }}>
                      <div className="learn-icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)' }}>
                        <Shield size={20} />
                      </div>
                      <h4 className="learn-title">Segurança</h4>
                      <p className="learn-description">
                        Ativos focados em altíssima liquidez e preservação de capital. Renda fixa DI pós-fixada, Tesouro Selic, e fundos taxa zero. Formam sua reserva de emergência e caixa operacional.
                      </p>
                    </div>

                    <div className="learn-card" style={{ borderTop: '4px solid var(--color-estabilidade)' }}>
                      <div className="learn-icon-box" style={{ backgroundColor: 'rgba(225, 82, 65, 0.1)', color: 'var(--color-estabilidade)' }}>
                        <Sliders size={20} />
                      </div>
                      <h4 className="learn-title">Estabilidade</h4>
                      <p className="learn-description">
                        Ativos de crédito privado de baixo risco ou multimercados focados em ganho acima da inflação com baixa oscilação diária. Oferecem previsibilidade no médio prazo.
                      </p>
                    </div>

                    <div className="learn-card" style={{ borderTop: '4px solid var(--color-diversificacao)' }}>
                      <div className="learn-icon-box" style={{ backgroundColor: 'rgba(241, 180, 76, 0.1)', color: 'var(--color-diversificacao)' }}>
                        <Layers size={20} />
                      </div>
                      <h4 className="learn-title">Diversificação</h4>
                      <p className="learn-description">
                        Ativos que buscam descorrelação dos índices padrão brasileiros, incluindo fundos macro globais, fundos imobiliários de infraestrutura, investimentos agrícolas e gestores com visão global.
                      </p>
                    </div>

                    <div className="learn-card" style={{ borderTop: '4px solid var(--color-valorizacao)' }}>
                      <div className="learn-icon-box" style={{ backgroundColor: 'rgba(52, 195, 143, 0.1)', color: 'var(--color-valorizacao)' }}>
                        <TrendingUp size={20} />
                      </div>
                      <h4 className="learn-title">Valorização</h4>
                      <p className="learn-description">
                        Renda variável de longo prazo, fundos de ações Long Only ou Long & Short. Focado em empresas de alta qualidade (Compounders) ou desvalorizadas fora do radar.
                      </p>
                    </div>

                    <div className="learn-card" style={{ borderTop: '4px solid var(--color-antifragilidade)' }}>
                      <div className="learn-icon-box" style={{ backgroundColor: 'rgba(80, 165, 241, 0.1)', color: 'var(--color-antifragilidade)' }}>
                        <DollarSign size={20} />
                      </div>
                      <h4 className="learn-title">Antifragilidade</h4>
                      <p className="learn-description">
                        Proteções cambiais (fundos de dólar comercial) e ouro físico ou indexado sem hedge. Ativos que se valorizam nos momentos de crise sistêmica ou inflação global descontrolada.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* SEARCH / ADD ASSET MODAL DIALOG */}
      {showAddAssetModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff', width: '90%', maxWidth: 760, borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', height: '80vh'
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>Selecione um ativo para adicionar</h3>
              <button 
                onClick={() => setShowAddAssetModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="search-bar-wrapper">
                <Search className="search-icon-inside" size={18} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Busque pelo nome, CNPJ ou ticker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Class Filters */}
              <div className="category-filter-bar">
                {['All', 'Segurança', 'Estabilidade', 'Diversificação', 'Valorização', 'Antifragilidade', 'Satélite'].map(cls => (
                  <button
                    key={cls}
                    className={`btn-filter ${
                      classFilter === cls 
                        ? (cls === 'All' ? 'active' : 'active-' + cls.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) 
                        : ''
                    }`}
                    onClick={() => setClassFilter(cls)}
                  >
                    {cls === 'All' ? 'Todos' : cls}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px' }}>
              <div className="selector-results-list">
                {funds
                  .filter(f => {
                    const matchesSearch = 
                      f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (f.cnpj && f.cnpj.includes(searchQuery)) ||
                      (f.ticker && f.ticker.toLowerCase().includes(searchQuery.toLowerCase()));
                    const matchesClass = classFilter === 'All' || f.class === classFilter;
                    // Filter according to portfolio previdencia type
                    const matchesPrevidencia = selectedPortfolio?.is_previdencia === f.is_previdencia;
                    return matchesSearch && matchesClass && matchesPrevidencia && f.class !== 'Benchmark';
                  })
                  .map(fund => (
                    <div key={fund.id} className="selector-result-row">
                      <div className="result-fund-info">
                        <div className="result-fund-name">{fund.name}</div>
                        <div className="result-fund-meta">
                          <span>{fund.class}</span>
                          <span>|</span>
                          <span>{fund.subcategory}</span>
                          {fund.cnpj && (
                            <>
                              <span>|</span>
                              <span>CNPJ: {fund.cnpj}</span>
                            </>
                          )}
                          {fund.ticker && (
                            <>
                              <span>|</span>
                              <span>Ticker: {fund.ticker}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button 
                        className="btn-add-fund-trigger"
                        onClick={() => handleAddAssetToPortfolio(fund)}
                      >
                        Selecionar
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
