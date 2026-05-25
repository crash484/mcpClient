import streamlit as st
import requests
from datetime import datetime

BACKEND_URL = "http://localhost:4000/chat"

st.set_page_config(
    page_title="NYC Subway Assistant",
    page_icon="🚇",
    layout="wide"
)

# ---------- CUSTOM CSS ----------
with open("styles.css") as f:
    st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# ---------- SIDEBAR ----------
with st.sidebar:
    st.title("🚇 NYC Subway Assistant")

    st.markdown("""
    Ask questions about:
    - Train delays
    - Subway routes
    - Station info
    - Transfers
    - Service status
    - Arrival timings
    """)

    st.divider()

    if st.button("🗑 Clear Chat"):
        st.session_state.messages = []
        st.rerun()

# ---------- HEADER ----------
st.markdown("""
<div class="main-header">
    <h1>🚇 NYC Subway Assistant</h1>
    <p>Powered by Claude + MCP</p>
</div>
""", unsafe_allow_html=True)

# ---------- SESSION ----------
if "messages" not in st.session_state:
    st.session_state.messages = []

# ---------- DISPLAY CHAT ----------
for message in st.session_state.messages:
    with st.chat_message(message["role"]):

        st.markdown(message["content"])

        if "timestamp" in message:
            st.caption(message["timestamp"])

# ---------- CHAT INPUT ----------
prompt = st.chat_input("Ask about NYC subway routes, delays, or stations...")

if prompt:

    timestamp = datetime.now().strftime("%H:%M")

    # USER MESSAGE
    st.session_state.messages.append({
        "role": "user",
        "content": prompt,
        "timestamp": timestamp
    })

    with st.chat_message("user"):
        st.markdown(prompt)
        st.caption(timestamp)

    # ASSISTANT RESPONSE
    with st.chat_message("assistant"):

        response_placeholder = st.empty()

        with st.spinner("Checking subway system..."):

            try:
                response = requests.post(
                    BACKEND_URL,
                    json={"message": prompt},
                    timeout=300
                )

                data = response.json()

                assistant_reply = data.get(
                    "response",
                    "No response received."
                )

            except Exception as e:
                assistant_reply = f"""
                ❌ Error connecting to backend

                Details:
                {str(e)}
                """

        response_placeholder.markdown(assistant_reply)

        st.caption(datetime.now().strftime("%H:%M"))

    # SAVE RESPONSE
    st.session_state.messages.append({
        "role": "assistant",
        "content": assistant_reply,
        "timestamp": datetime.now().strftime("%H:%M")
    })