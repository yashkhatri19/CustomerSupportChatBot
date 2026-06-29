import { useState, useEffect, useRef } from 'react';

function App() {
  // --- AUTHENTICATION STATES ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  const [userName, setUserName] = useState(() => {
    return localStorage.getItem("userName") || "Guest";
  });

  const [currentUserEmail, setCurrentUserEmail] = useState(() => {
    return localStorage.getItem("currentUserEmail") || "guest";
  });

  // --- CONVERSATIONAL STATES ---
  const [conversations, setConversations] = useState(() => {
    const activeUser = localStorage.getItem("currentUserEmail") || "guest";
    const savedChats = localStorage.getItem(`chats_${activeUser}`);
    return savedChats ? JSON.parse(savedChats) : [
      {
        id: 'session-1',
        title: 'Initial AI Query',
        messages: [{ text: "Hello! Welcome to SupportAI. How can I help you today?", sender: 'bot', time: '02:22 PM' }]
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    const activeUser = localStorage.getItem("currentUserEmail") || "guest";
    return localStorage.getItem(`active_session_${activeUser}`) || 'session-1';
  });

  // Standard UI States
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState('login');

  // Modal form input fields
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [registerNameInput, setRegisterNameInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");

  const chatEndRef = useRef(null);

  // --- AUTOMATIC PERSISTENCE EFFECT LISTENERS ---
  useEffect(() => {
    localStorage.setItem(`chats_${currentUserEmail}`, JSON.stringify(conversations));
  }, [conversations, currentUserEmail]);

  useEffect(() => {
    localStorage.setItem(`active_session_${currentUserEmail}`, activeSessionId);
  }, [activeSessionId, currentUserEmail]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeSessionId, loading]);

  const currentConversation = conversations.find(c => c.id === activeSessionId) || conversations[0] || { title: "No Active Chat", messages: [] };

  // Action Handler: Fresh Workspace
  const handleCreateNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newChatObj = {
      id: newId,
      title: `New Chat Session`,
      messages: [{ text: "Started a fresh workspace. Drop your query below.", sender: 'bot', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]
    };
    setConversations(prev => [newChatObj, ...prev]);
    setActiveSessionId(newId);
    setIsOpen(true);
  };

  // Action Handler: Delete Chat
  const handleDeleteChat = (e, sessionIdToDelete) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      const defaultId = `session-${Date.now()}`;
      const defaultReset = [
        {
          id: defaultId,
          title: 'Initial AI Query',
          messages: [{ text: "Hello! Welcome to SupportAI. How can I help you today?", sender: 'bot', time: '02:22 PM' }]
        }
      ];
      setConversations(defaultReset);
      setActiveSessionId(defaultId);
      return;
    }
    const updatedConversations = conversations.filter(chat => chat.id !== sessionIdToDelete);
    setConversations(updatedConversations);
    if (activeSessionId === sessionIdToDelete) {
      setActiveSessionId(updatedConversations[0].id);
    }
  };

  // Action Handler: Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentConversation.id) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage = { text: inputMessage, sender: 'user', time: currentTime };

    let updatedTitle = currentConversation.title;
    if (!currentConversation.messages || currentConversation.messages.length <= 1) {
      updatedTitle = inputMessage.length > 22 ? inputMessage.substring(0, 20) + "..." : inputMessage;
    }
     
    // Update the conversation with the new user message and possibly updated title
    setConversations(prev => prev.map(chat => {
      if (chat.id === activeSessionId) {
        return { ...chat, title: updatedTitle, messages: [...(chat.messages || []), userMessage] };
      }
      return chat;
    }));

    const promptCache = inputMessage;
    setInputMessage("");
    setLoading(true);
    
    try {
      const backendUrl = window.location.hostname === "localhost"
        ? "http://localhost:5000/api/query_support"
        : "https://customersupport-sx37.onrender.com/api/query_support";

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptCache }),
      });

      if (!response.ok) throw new Error("Server disconnected");
      const data = await response.json();

      const botMessage = {
        text: data.reply || "Processed successfully.",
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      // Append the bot's response to the current conversation
      setConversations(prev => prev.map(chat => {
        if (chat.id === activeSessionId) {
          return { ...chat, messages: [...(chat.messages || []), botMessage] };
        }
        return chat;
      }));
        // debugging: Log the bot's response
    } catch (error) {
      console.error(error);
      const errorMessage = { text: "Unable to sync with processing nodes right now.", sender: 'bot', time: 'OFFLINE' };
      setConversations(prev => prev.map(chat => {
        if (chat.id === activeSessionId) {
          return { ...chat, messages: [...(chat.messages || []), errorMessage] };
        }
        return chat;
      }));
    } finally {
      setLoading(false);
    }
  };

  // --- AUTHENTICATION HANDLERS ---
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    const normalizedEmail = emailInput.toLowerCase().trim();
    const localUsersDb = JSON.parse(localStorage.getItem("app_users_database")) || {};
    let computedName = "Guest";
    // Handle login and registration logic
    if (authTab === 'login') {
      if (!localUsersDb[normalizedEmail]) {
        alert("Account not found! This email is not registered. Please switch to 'Create Account' first.");
        return;
      }
      if (localUsersDb[normalizedEmail].password !== passwordInput) {
        alert("Incorrect password! Please try again.");
        return;
      }
      computedName = localUsersDb[normalizedEmail].name;
    } else {
      if (passwordInput !== confirmPasswordInput) {
        alert("Passwords do not match!");
        return;
      }
      if (localUsersDb[normalizedEmail]) {
        alert("This email is already registered! Please log in instead.");
        return;
      }
      computedName = registerNameInput.toUpperCase();
      localUsersDb[normalizedEmail] = { name: computedName, password: passwordInput };
      localStorage.setItem("app_users_database", JSON.stringify(localUsersDb));
      alert("Account registered successfully! Logging you in...");
    }

    setIsLoggedIn(true);
    setUserName(computedName);
    setCurrentUserEmail(normalizedEmail);
    
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userName", computedName);
    localStorage.setItem("currentUserEmail", normalizedEmail);

    const userSavedChats = localStorage.getItem(`chats_${normalizedEmail}`);
    if (userSavedChats && JSON.parse(userSavedChats).length > 0) {
      setConversations(JSON.parse(userSavedChats));
    } else {
      setConversations([
        {
          id: 'session-1',
          title: 'Initial AI Query',
          messages: [{ text: `Hello ${computedName}! Welcome to SupportAI. How can I help you today?`, sender: 'bot', time: '02:22 PM' }]
        }
      ]);
    }

    const userActiveSession = localStorage.getItem(`active_session_${normalizedEmail}`);
    setActiveSessionId(userActiveSession || 'session-1');

    setShowAuthModal(false);
    setEmailInput("");
    setPasswordInput("");
    setRegisterNameInput("");
    setConfirmPasswordInput("");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserName("Guest");
    setCurrentUserEmail("guest");
    
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userName");
    localStorage.removeItem("currentUserEmail");

    const guestChats = localStorage.getItem("chats_guest");
    if (guestChats) {
      setConversations(JSON.parse(guestChats));
    } else {
      setConversations([
        {
          id: 'session-1',
          title: 'Initial AI Query',
          messages: [{ text: "Hello! Welcome to SupportAI. How can I help you today?", sender: 'bot', time: '02:22 PM' }]
        }
      ]);
    }
    const guestSession = localStorage.getItem("active_session_guest");
    setActiveSessionId(guestSession || 'session-1');
  };

  return (
    <div style={styles.appViewContainer}>
      {/* LEFT SIDEBAR PANEL */}
      <aside style={{ ...styles.chatGptSidebar, marginLeft: isSidebarVisible ? '0px' : '-260px', opacity: isSidebarVisible ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <button style={styles.newChatButton} onClick={handleCreateNewChat}>
          <span style={styles.plusIcon}>+</span> New chat
        </button>

        <div style={styles.historyScrollFeed}>
          <div style={styles.sidebarSectionHeading}>Recent Threads</div>
          {conversations.map((chat) => {
            const isActive = chat.id === activeSessionId;
            return (
              <div key={chat.id} onClick={() => { setActiveSessionId(chat.id); setIsOpen(true); }} style={{ ...styles.historyItemNode, background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent', color: isActive ? '#ffffff' : '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flexGrow: 1 }}>
                  <svg style={styles.chatBubbleIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span style={styles.historyTruncatedTitle}>{chat.title}</span>
                </div>
                <button onClick={(e) => handleDeleteChat(e, chat.id)} style={styles.deleteHistoryItemBtn} title="Delete conversation">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        <div style={styles.sidebarUserFooter} onClick={() => setIsSidebarVisible(false)}>
          <div style={styles.userAvatarSlot}>{userName.charAt(0)}</div>
          <div style={styles.userMetaDataText}>
            <span style={styles.userTextLabel}>{isLoggedIn ? userName : "Guest Sandbox"}</span>
            <span style={styles.clickToCloseSubtext}>Click to hide sidebar</span>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN CANVAS CONTAINER */}
      <div style={styles.mainCanvasLayout}>
        <nav style={styles.navbar}>
          <div style={styles.logoGroup}>
            {!isSidebarVisible && <button onClick={() => setIsSidebarVisible(true)} style={styles.sidebarToggleButton}>&#9776;</button>}
            <div style={styles.logo}>SupportAI</div>
          </div>
          <div style={styles.navAuthWrapper}>
            {isLoggedIn ? (
              <button type="button" onClick={handleLogout} style={styles.logoutBtn}>Log Out</button>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => { setAuthTab('login'); setShowAuthModal(true); }} style={styles.loginBtn}>Log In</button>
                <button type="button" onClick={() => { setAuthTab('register'); setShowAuthModal(true); }} style={styles.registerBtn}>Sign Up</button>
              </div>
            )}
          </div>
        </nav>

        {/* PERFECTLY CENTERED HERO SECTION */}
        <main style={styles.heroSection}>
          <div style={styles.heroContentWrapper}>
            <h1 style={styles.heroTitle}>Transform Customer Support With AI</h1>
            <p style={styles.heroSubtitle}>Provides 24*7 intelligent customer support with lightning-fast AI responses.</p>
            <button style={styles.heroButton} onClick={() => setIsOpen(true)}>Click Here to Ask Anything</button>
          </div>
        </main>

        {/* WIDGET WRAPPER WITH BETTER RESPONSIVENESS */}
        <div style={styles.widgetWrapper}>
          {isOpen ? (
            <div style={styles.chatWindow}>
              <div style={styles.chatHeader}>
                <div style={styles.headerInfoGroup}>
                  <div style={styles.pulseActiveIndicator}></div>
                  <span style={styles.headerTitle}>{currentConversation.title}</span>
                </div>
                <button style={styles.closeBtn} onClick={() => setIsOpen(false)}>×</button>
              </div>
              <div style={styles.chatBody}>
                {currentConversation.messages && currentConversation.messages.map((msg, index) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div key={index} style={{ ...styles.msgRow, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                      <div style={{ ...styles.bubble, background: isUser ? '#3b82f6' : '#f1f5f9', color: isUser ? '#ffffff' : '#1e293b', borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px' }}>
                        <div style={styles.bubbleText}>{msg.text}</div>
                        <div style={{ ...styles.timeText, color: isUser ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>{msg.time}</div>
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
                    <div style={{ ...styles.bubble, background: '#f1f5f9', color: '#64748b' }}>
                      <div style={styles.pulseTypingDots}><span>•</span><span>•</span><span>•</span></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} style={styles.chatFooterForm}>
                <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Type a response..." style={styles.chatInput} disabled={loading} />
                <button type="submit" disabled={loading} style={styles.sendBtn}>Send</button>
              </form>
            </div>
          ) : (
            <button style={styles.launcherIcon} onClick={() => setIsOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAuthModal(false)}>
          <div style={styles.modalContentCard} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalCornerCloseX} onClick={() => setShowAuthModal(false)}>&times;</button>
            <div style={styles.tabsHeaderContainer}>
              <button type="button" onClick={() => setAuthTab('login')} style={{ ...styles.tabHeadingToggle, color: authTab === 'login' ? '#3b82f6' : '#64748b', borderBottom: authTab === 'login' ? '2px solid #3b82f6' : '2px solid transparent' }}>Sign In</button>
              <button type="button" onClick={() => setAuthTab('register')} style={{ ...styles.tabHeadingToggle, color: authTab === 'register' ? '#3b82f6' : '#64748b', borderBottom: authTab === 'register' ? '2px solid #3b82f6' : '2px solid transparent' }}>Create Account</button>
            </div>
            <p style={styles.modalSubheadingText}>{authTab === 'login' ? "Welcome back! Enter your credentials to login." : "Create your account to secure separate prompt threads."}</p>
            <form onSubmit={handleAuthSubmit} style={styles.modalFormLayout}>
              {authTab === 'register' && (
                <div style={styles.inputFieldContainer}>
                  <label style={styles.inputLabelElement}>Your Full Name</label>
                  <input type="text" placeholder="John Doe" value={registerNameInput} onChange={(e) => setRegisterNameInput(e.target.value)} style={styles.modalFormInputItem} required />
                </div>
              )}
              <div style={styles.inputFieldContainer}>
                <label style={styles.inputLabelElement}>Email Address</label>
                <input type="email" placeholder="name@company.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} style={styles.modalFormInputItem} required />
              </div>
              <div style={styles.inputFieldContainer}>
                <label style={styles.inputLabelElement}>Password</label>
                <input type="password" placeholder="••••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={styles.modalFormInputItem} required />
              </div>
              {authTab === 'register' && (
                <div style={styles.inputFieldContainer}>
                  <label style={styles.inputLabelElement}>Confirm Password</label>
                  <input type="password" placeholder="••••••••" value={confirmPasswordInput} onChange={(e) => setConfirmPasswordInput(e.target.value)} style={styles.modalFormInputItem} required />
                </div>
              )}
              <button type="submit" style={styles.modalSubmitActionButton}>{authTab === 'login' ? "Sign In Securely" : "Sign Up and Start"}</button>
            </form>
            <div style={styles.modalTabFooterPrompt}>
              {authTab === 'login' ? (
                <span>Don't have an account? <span style={styles.footerLinkAction} onClick={() => setAuthTab('register')}>Register here</span></span>
              ) : (
                <span>Already have an account? <span style={styles.footerLinkAction} onClick={() => setAuthTab('login')}>Log In here</span></span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fixed Spacing & Centering Design tokens
const styles = {
  appViewContainer: { display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', overflow: 'hidden', fontFamily: '"Inter", sans-serif', boxSizing: 'border-box', margin: 0, padding: 0 },
  chatGptSidebar: { width: '260px', minWidth: '260px', height: '100vh', background: '#0b0f19', borderRight: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', padding: '12px', boxSizing: 'border-box', zIndex: 100 },
  newChatButton: { width: '100%', background: 'transparent', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', padding: '12px 16px', fontSize: '14px', fontWeight: '500', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', outline: 'none' },
  plusIcon: { fontSize: '16px' },
  historyScrollFeed: { flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' },
  sidebarSectionHeading: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.5px', padding: '0 8px 6px 8px' },
  historyItemNode: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  chatBubbleIcon: { opacity: 0.6, flexShrink: 0 },
  historyTruncatedTitle: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '150px' },
  deleteHistoryItemBtn: { background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', outline: 'none' },
  sidebarUserFooter: { borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto', cursor: 'pointer', borderRadius: '8px', padding: '8px' },
  userAvatarSlot: { width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f6', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', flexShrink: 0 },
  userMetaDataText: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  userTextLabel: { fontSize: '13px', color: '#e2e8f0', fontWeight: '600' },
  clickToCloseSubtext: { fontSize: '10px', color: '#64748b' },
  
  // FIXED CANVAS LAYOUT FOR CENTERING
  mainCanvasLayout: { flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box', overflow: 'hidden' },
  navbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 4%', background: 'transparent', width: '100%', boxSizing: 'border-box', zIndex: 10 },
  logoGroup: { display: 'flex', alignItems: 'center', gap: '16px' },
  sidebarToggleButton: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff', fontSize: '18px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' },
  logo: { fontSize: '22px', fontWeight: '800', color: '#ffffff' },
  navAuthWrapper: { display: 'flex', alignItems: 'center' },
  loginBtn: { padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff' },
  registerBtn: { padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: '#3b82f6', border: 'none', color: '#ffffff' },
  logoutBtn: { padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ffffff' },
  
  // ADJUSTED HERO WITH EMBEDDED CONTENT WRAPPER
  heroSection: { flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', width: '100%', height: '100%', padding: '0 40px 100px 40px', boxSizing: 'border-box', position: 'absolute', top: 0, left: 0 },
  heroContentWrapper: { maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: '48px', fontWeight: '800', margin: '0 0 20px 0', color: '#ffffff', lineHeight: '1.2' },
  heroSubtitle: { fontSize: '16px', color: '#94a3b8', maxWidth: '520px', margin: '0 0 32px 0', lineHeight: '1.5' },
  heroButton: { background: '#ffffff', color: '#000000', border: '1px solid #ffffff', padding: '14px 28px', borderRadius: '50px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,255,255,0.1)' },
  
  // OVERLAP PREVENTED WIDGET
  widgetWrapper: { position: 'absolute', bottom: '30px', right: '40px', zIndex: 99 },
  chatWindow: { width: '380px', height: '480px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '16px' },
  chatHeader: { background: '#1e293b', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerInfoGroup: { display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '80%' },
  pulseActiveIndicator: { width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' },
  headerTitle: { color: '#ffffff', fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  closeBtn: { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' },
  chatBody: { flexGrow: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc' },
  msgRow: { display: 'flex', width: '100%' },
  bubble: { padding: '10px 14px', maxWidth: '85%' },
  bubbleText: { fontSize: '13.5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  timeText: { fontSize: '9px', marginTop: '4px', textAlign: 'right' },
  pulseTypingDots: { display: 'flex', gap: '3px', fontSize: '16px' },
  chatFooterForm: { display: 'flex', padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#ffffff', alignItems: 'center', gap: '10px' },
  chatInput: { flexGrow: 1, border: 'none', background: 'transparent', fontSize: '14px', color: '#1e293b', outline: 'none' },
  sendBtn: { background: '#1e293b', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  launcherIcon: { width: '56px', height: '56px', borderRadius: '50%', background: '#3b82f6', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modalContentCard: { background: '#ffffff', width: '440px', padding: '36px', borderRadius: '20px', display: 'flex', flexDirection: 'column', color: '#1e293b', boxSizing: 'border-box', position: 'relative' },
  modalCornerCloseX: { position: 'absolute', top: '16px', right: '20px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' },
  tabsHeaderContainer: { display: 'flex', gap: '20px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' },
  tabHeadingToggle: { background: 'transparent', border: 'none', fontSize: '18px', fontWeight: '700', padding: '0 4px 10px 4px', cursor: 'pointer', outline: 'none' },
  modalSubheadingText: { fontSize: '13.5px', color: '#64748b', margin: '0 0 24px 0' },
  modalFormLayout: { display: 'flex', flexDirection: 'column', gap: '16px' },
  inputFieldContainer: { display: 'flex', flexDirection: 'column', gap: '6px' },
  inputLabelElement: { fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  modalFormInputItem: { padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', background: '#f8fafc', outline: 'none', width: '100%', boxSizing: 'border-box' },
  modalSubmitActionButton: { background: '#3b82f6', color: '#ffffff', border: 'none', padding: '13px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  modalTabFooterPrompt: { fontSize: '13px', color: '#64748b', textAlign: 'center', marginTop: '20px' },
  footerLinkAction: { color: '#3b82f6', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }
};

export default App;