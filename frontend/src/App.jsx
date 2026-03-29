import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { 
  Send, Sparkles, MessageSquare, BarChart3, Menu, Copy, Check, Loader2, Database, Table, 
  CheckCircle, XCircle, Clock, Rows
} from 'lucide-react'
import './App.css'
import { chartData } from './chartData'

const API_URL = 'http://localhost:8000/api'

const COLORS = ['#b65df0', '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#84cc16']

const SUGGESTIONS = [
  "How many businesses are in Philadelphia?",
  "What are the top 10 categories by review count?",
  "Show average rating by city"
]

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const inputRef = useRef(null)
  const isAtBottomRef = useRef(true)

  const STAGES = [
    { key: 'thinking', text: 'Thinking', duration: 800 },
    { key: 'extracting', text: 'Extracting SQL command', duration: 600 },
    { key: 'executing', text: 'Executing SQL command', duration: 800 },
    { key: 'finalizing', text: 'Finalizing the answer', duration: 400 },
  ]

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100
    }
  }, [])

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current && isAtBottomRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  }, [])

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom()
    }
  }, [messages, streamingContent, scrollToBottom])

  const handleSuggestion = (suggestion) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const startTime = Date.now()
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setLoadingStage('thinking')
    setStreamingContent('')

    const loadingId = Date.now() + 1
    
    const streamingMessage = {
      id: loadingId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      loadingStage: 'thinking',
      timestamp: Date.now(),
      startTime
    }
    setMessages(prev => [...prev, streamingMessage])

    const cycleStages = async () => {
      for (let i = 0; i < STAGES.length; i++) {
        await new Promise(resolve => setTimeout(resolve, STAGES[i].duration))
        const nextStage = STAGES[i + 1]
        if (nextStage) {
          setLoadingStage(nextStage.key)
          setMessages(prev => prev.map(m => 
            m.id === loadingId ? { ...m, loadingStage: nextStage.key } : m
          ))
        }
      }
    }

    try {
      await cycleStages()
      
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content })
      })
      const data = await response.json()
      const endTime = Date.now()
      const elapsed = endTime - startTime

      if (data.error) {
        setMessages(prev => prev.map(m => 
          m.id === loadingId ? { 
            ...m, 
            content: `Error: ${data.error}`, 
            sql: data.sql,
            isError: true,
            isStreaming: false,
            loadingStage: null,
            elapsed,
            executedAt: new Date().toISOString()
          } : m
        ))
        } else {
        const summary = generateSummary(userMessage.content, data.rows, data.sql)
        console.log('[DEBUG] Frontend received:', { rows: data.rows?.length, sql: data.sql })
        setMessages(prev => prev.map(m => 
          m.id === loadingId ? { 
            ...m, 
            content: summary,
            sql: data.sql,
            rows: data.rows || [],
            isStreaming: false,
            loadingStage: null,
            elapsed,
            executedAt: new Date().toISOString()
          } : m
        ))
      }
    } catch (error) {
      setMessages(prev => prev.map(m => 
        m.id === loadingId ? { 
          ...m, 
          content: `Connection error: ${error.message}. Make sure the backend is running.`,
          isError: true,
          isStreaming: false,
          loadingStage: null,
          elapsed: Date.now() - startTime,
          executedAt: new Date().toISOString()
        } : m
      ))
    }

    setIsLoading(false)
    setLoadingStage('')
  }

  const generateSummary = (question, rows, sql) => {
    if (!rows || rows.length === 0) {
      return "No results found for your query."
    }

    const columns = Object.keys(rows[0])
    const questionLower = question.toLowerCase()
    
    const numericCols = columns.filter(col => 
      rows.some(row => typeof row[col] === 'number' || !isNaN(Number(row[col])))
    )
    const categoricalCols = columns.filter(col => !numericCols.includes(col))
    
    let summary = ''

    const isSingleValue = rows.length === 1 && columns.length === 1
    const isTwoColumns = rows.length === 1 && columns.length === 2
    
    if (isSingleValue) {
      const value = Object.values(rows[0])[0]
      const formattedValue = typeof value === 'number' ? value.toLocaleString() : value
      
      if (questionLower.includes('how many') || questionLower.includes('count')) {
        summary = `The answer is ${formattedValue}.`
      } else if (questionLower.includes('average') || questionLower.includes('avg')) {
        summary = `The average is ${formattedValue}.`
      } else if (questionLower.includes('highest') || questionLower.includes('top') || questionLower.includes('best')) {
        summary = `The highest value is ${formattedValue}.`
      } else if (questionLower.includes('lowest') || questionLower.includes('worst')) {
        summary = `The lowest value is ${formattedValue}.`
      } else {
        summary = `The result is ${formattedValue}.`
      }
    }
    else if (isTwoColumns) {
      const [col1, col2] = columns
      const [val1, val2] = [rows[0][col1], rows[0][col2]]
      
      if (questionLower.includes('how many') || questionLower.includes('count')) {
        summary = `There are ${val1} ${val2 || ''} matching your query.`
      } else if (questionLower.includes('average') || questionLower.includes('avg')) {
        summary = `The average ${col2 || 'value'} is ${val1}.`
      } else if (questionLower.includes('top') || questionLower.includes('best')) {
        summary = `The top result is: ${val1} (${val2})`
      } else {
        summary = `${col1}: ${val1}, ${col2}: ${val2}`
      }
    }
    else if ((questionLower.includes('how many') || questionLower.includes(' total')) && !questionLower.includes('review count')) {
      const total = rows.length
      summary = `Found ${total} results in total.`
    } 
    else if (questionLower.includes('top') || questionLower.includes('best') || questionLower.includes('highest') || questionLower.includes('most')) {
      summary = `Top ${Math.min(rows.length, 10)} results are shown in the table below.`
    }
    else if (questionLower.includes('average') || questionLower.includes('avg')) {
      if (numericCols.length > 0) {
        const avgValue = rows.reduce((sum, row) => sum + (Number(row[numericCols[0]]) || 0), 0) / rows.length
        summary = `The average ${numericCols[0]} is ${avgValue.toFixed(2)} across ${rows.length} entries.`
      } else {
        summary = `Query returned ${rows.length} results with an average value.`
      }
    }
    else if (questionLower.includes('city') || questionLower.includes('location')) {
      summary = `Found data for ${rows.length} different locations.`
    }
    else if (questionLower.includes('category')) {
      summary = `Found ${rows.length} categories.`
    }
    else {
      summary = `Query returned ${rows.length} results.`
    }
    
    return summary
  }

  return (
    <div className="app">
      <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-mark">
            <Sparkles size={20} />
          </div>
          <h2>Yelp Explorer</h2>
        </div>
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => { 
              if (activeTab === 'chat' && messages.length > 0) {
                setMessages([])
              }
              setActiveTab('chat'); 
              setSidebarOpen(false); 
            }}
          >
            <MessageSquare size={18} />
            <span>Chat</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analytics'); setSidebarOpen(false); }}
          >
            <BarChart3 size={18} />
            <span>Charts</span>
          </button>
        </nav>
      </aside>

      <main className="main-content">
        {activeTab === 'chat' ? (
          <div className="chat-layout">
            <div className="conversation-canvas" ref={messagesContainerRef} onScroll={handleScroll}>
              <div className="canvas-inner">
                {messages.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Sparkles size={32} />
                    </div>
                    <h1>How can I help you?</h1>
                    <p>Ask me anything about Yelp businesses, reviews, or trends</p>
                    <div className="suggestions-inline">
                      {SUGGESTIONS.map((suggestion, idx) => (
                        <button 
                          key={idx} 
                          className="suggestion-chip"
                          onClick={() => handleSuggestion(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, idx) => (
                  <MessageBlock 
                    key={message.id} 
                    message={message}
                    isLast={idx === messages.length - 1}
                    onCopy={copyToClipboard}
                    copiedId={copiedId}
                  />
                ))}

                <div ref={messagesEndRef} className="messages-end" />
              </div>
            </div>

            <div className="input-container">
              <form className="input-bar" onSubmit={handleSubmit}>
                <div className="input-wrapper">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything..."
                    disabled={isLoading}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (input.trim() && !isLoading) {
                          handleSubmit(e)
                        }
                      }
                    }}
                    onInput={(e) => {
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                    }}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading || !input.trim()}
                  className={`send-btn ${input.trim() ? 'active' : ''}`}
                >
                  {isLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                </button>
              </form>
              <p className="input-hint">Yelp data • Text to SQL</p>
            </div>

          </div>
        ) : (
          <AnalyticsView />
        )}
      </main>
    </div>
  )
}

function MessageBlock({ message, isLast, onCopy, copiedId }) {
  const getStageText = (stage) => {
    switch (stage) {
      case 'thinking': return 'Thinking'
      case 'extracting': return 'Extracting SQL command'
      case 'executing': return 'Executing SQL command'
      case 'finalizing': return 'Finalizing the answer'
      default: return ''
    }
  }

  if (message.role === 'user') {
    return (
      <div className="message-row user">
        <div className="message-content">
          <div className="message-body">
            <p>{message.content}</p>
          </div>
        </div>
      </div>
    )
  }

  if (message.loadingStage) {
    return (
      <div className="message-row assistant">
        <div className="message-content">
          <div className="message-body loading-body">
            <span className="loading-stage">{getStageText(message.loadingStage)}</span>
            <span className="loading-cursor" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="message-row assistant">
      <div className="message-content">
        <div className={`message-body ${message.isError ? 'error' : ''}`}>
          <TypingText text={message.content} isStreaming={message.isStreaming} />
        </div>
        
        {!message.isStreaming && message.content && (
          <div className="message-actions">
            <button 
              className="action-btn" 
              onClick={(e) => { e.stopPropagation(); onCopy(message.sql || message.content, message.id); }}
            >
              {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
              {copiedId === message.id ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {!message.isStreaming && (
          <div className="query-details">
            {message.rows && message.rows.length === 1 && Object.keys(message.rows[0]).length === 1 && (
              <div className="single-value-display">
                <span className="single-value-label">Result</span>
                <span className="single-value-number">
                  {typeof Object.values(message.rows[0])[0] === 'number' 
                    ? Object.values(message.rows[0])[0].toLocaleString() 
                    : Object.values(message.rows[0])[0]}
                </span>
              </div>
            )}

            <div className="details-metrics">
              <div className="metric-item">
                <span className="metric-label"><CheckCircle size={12} /> Status</span>
                <span className={`metric-value ${message.isError ? 'error' : 'success'}`}>
                  {message.isError ? <XCircle size={14} /> : <CheckCircle size={14} />} {message.isError ? 'Failed' : 'Success'}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label"><Clock size={12} /> Time</span>
                <span className="metric-value">{message.elapsed ? `${message.elapsed}ms` : '-'}</span>
              </div>
              {message.rows && (
                <div className="metric-item">
                  <span className="metric-label"><Rows size={12} /> Rows</span>
                  <span className="metric-value">{message.rows.length}</span>
                </div>
              )}
              {message.rows && message.rows.length > 0 && (
                <div className="metric-item">
                  <span className="metric-label"><Table size={12} /> Columns</span>
                  <span className="metric-value">{Object.keys(message.rows[0]).length}</span>
                </div>
              )}
            </div>

            {message.sql && (
              <div className="details-sql">
                <h4><Database size={16} /> Generated SQL</h4>
                <div className="panel-code">
                  <SyntaxHighlighter 
                    language="sql" 
                    style={oneDark}
                    customStyle={{ margin: 0, borderRadius: '8px', fontSize: '12px' }}
                  >
                    {message.sql}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {message.rows && message.rows.length > 0 && (
              <div className="details-table">
                <h4><Table size={16} /> Data Table ({message.rows.length} rows)</h4>
                <DataTableFull data={message.rows.slice(0, 50)} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingText({ text, isStreaming }) {
  const [displayed, setDisplayed] = useState('')
  
  useEffect(() => {
    if (!text) {
      setDisplayed('')
      return
    }
    
    if (!isStreaming) {
      setDisplayed(text)
      return
    }

    let index = 0
    const chunkSize = 3
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayed(text.substring(0, index + chunkSize))
        index += chunkSize
      } else {
        clearInterval(interval)
      }
    }, 20)

    return () => clearInterval(interval)
  }, [text, isStreaming])

  return (
    <span className="typing-text">
      {displayed}
    </span>
  )
}

function ThinkingSkeleton() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-lines">
        <div className="skeleton-line" style={{ width: '80%' }} />
        <div className="skeleton-line" style={{ width: '60%' }} />
        <div className="skeleton-line" style={{ width: '90%' }} />
      </div>
    </div>
  )
}

function InlineDataDisplay({ data }) {
  if (!data || data.length === 0) return null

  const columns = Object.keys(data[0])
  const numericCols = columns.filter(col => 
    data.some(row => typeof row[col] === 'number' || !isNaN(Number(row[col])))
  )
  const categoricalCols = columns.filter(col => !numericCols.includes(col))

  const hasChartData = categoricalCols.length > 0 && numericCols.length > 0

  const chartData = hasChartData ? data.slice(0, 10).map(row => ({
    name: String(row[categoricalCols[0]]).length > 20 ? String(row[categoricalCols[0]]).substring(0, 20) + '...' : row[categoricalCols[0]],
    value: Number(row[numericCols[0]]) || 0
  })) : []

  return (
    <div className="inline-data-container">
      {hasChartData && (
        <div className="inline-chart-section">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#888' }} width={140} />
              <Tooltip 
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="value" fill="#a78bfa" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      
      <div className="inline-table-section">
        <table className="inline-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 15).map((row, idx) => (
              <tr key={idx}>
                {columns.map(col => (
                  <td key={col}>{row[col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 15 && (
          <p className="inline-table-note">Showing 15 of {data.length} results</p>
        )}
      </div>
    </div>
  )
}

function DataPreviewChart({ data }) {
  if (!data || data.length === 0) return null

  const columns = Object.keys(data[0])
  const numericCols = columns.filter(col => 
    data.some(row => typeof row[col] === 'number' || !isNaN(Number(row[col])))
  )
  const categoricalCols = columns.filter(col => !numericCols.includes(col))

  if (categoricalCols.length === 0 || numericCols.length === 0) return null

  const labelCol = categoricalCols[0]
  const valueCol = numericCols[0]

  const chartData = data.slice(0, 8).map(row => ({
    name: String(row[labelCol]).length > 15 ? String(row[labelCol]).substring(0, 15) + '...' : row[labelCol],
    value: Number(row[valueCol]) || 0
  }))

  return (
    <div className="preview-chart">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} interval={0} />
          <YAxis tick={{ fontSize: 10, fill: '#888' }} />
          <Tooltip 
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
            labelStyle={{ color: '#fff' }}
          />
          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DataTableMini({ data }) {
  if (!data || data.length === 0) return null
  const columns = Object.keys(data[0])

  return (
    <div className="mini-table-wrapper">
      <table className="mini-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map(col => (
                <td key={col}>{row[col]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataTableFull({ data }) {
  console.log('[DEBUG] DataTableFull received:', data)
  if (!data || data.length === 0) {
    return (
      <div className="no-data-message">
        No data available
      </div>
    )
  }
  const columns = Object.keys(data[0])
  console.log('[DEBUG] Table columns:', columns, 'Rows:', data.length)

  return (
    <div className="table-container">
      <table className="full-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{formatColumnName(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map(col => (
                <td key={col} title={String(row[col])}>{formatCellValue(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatColumnName(col) {
  return col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatCellValue(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...'
  }
  return String(value)
}

function AnalyticsView() {
  return (
    <div className="analytics-container">
      <h1>Charts & Analytics</h1>
      <p className="analytics-desc">Explore pre-built visualizations of the Yelp dataset ({chartData.length} charts)</p>
      <div className="charts-grid">
        {chartData.map((chart) => (
          <ChartCard key={chart.id} chart={chart} />
        ))}
      </div>
    </div>
  )
}

function ChartCard({ chart }) {
  const { title, yLabel, xLabel, type, data } = chart

  const formatValue = (val) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M'
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K'
    return val.toLocaleString()
  }

  const colors = ['#a78bfa', '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#84cc16']

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>{title}</h3>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          {type === 'line' ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: '#888' }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#888' }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
              <Tooltip 
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value) => [formatValue(value), yLabel]}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#a78bfa" 
                strokeWidth={2}
                dot={{ fill: '#a78bfa', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#a78bfa' }}
              />
            </LineChart>
          ) : type === 'horizontalBar' ? (
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
              <XAxis 
                type="number" 
                tick={{ fontSize: 10, fill: '#888' }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fontSize: 9, fill: '#888' }} 
                width={100}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                formatter={(value) => [formatValue(value), yLabel]}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: '#888' }} 
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#888' }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
              <Tooltip 
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                formatter={(value) => [formatValue(value), yLabel]}
              />
              <Bar dataKey="value" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="chart-footer">
        <span className="chart-meta">{data.length} items</span>
      </div>
    </div>
  )
}

export default App
