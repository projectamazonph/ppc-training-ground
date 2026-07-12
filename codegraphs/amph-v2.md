# amph-v2 - Code Dependency Graph

\`\`\`mermaid
graph TD
    adt_agents_browser_agent["adt_agents/browser_agent.py"]
    adt_agents_orchestrator["adt_agents/orchestrator.py"]
    adt_agents_adt_logger["adt_agents/adt_logger.py"]
    adt_core_campaign_crud["adt_core/campaign_crud.py"]
    adt_core_campaign_builder["adt_core/campaign_builder.py"]
    adt_core_keyword_router["adt_core/keyword_router.py"]
    adt_core_bidding_engine["adt_core/bidding_engine.py"]
    adt_core_portfolio_optimizer["adt_core/portfolio_optimizer.py"]
    adt_dspy_debate_module["adt_dspy/debate_module.py"]
    adt_dspy_reasoning_tracer["adt_dspy/reasoning_tracer.py"]
    adt_dspy_signature_optimizer["adt_dspy/signature_optimizer.py"]
    adt_tools_google_ads_connector["adt_tools/google_ads_connector.py"]
    adt_tools_amazon_ads_connector["adt_tools/amazon_ads_connector.py"]
    adt_tools_data_studio_reporter["adt_tools/data_studio_reporter.py"]
    adt_tools_competitor_intel["adt_tools/competitor_intel.py"]
    adt_ui_streamlit_app["adt_ui/streamlit_app.py"]
    adt_ui_dashboard["adt_ui/dashboard.py"]
    adt_ui_portfolio_view["adt_ui/portfolio_view.py"]
    adt_ui_keyword_lab["adt_ui/keyword_lab.py"]
    adt_ui_bid_simulator["adt_ui/bid_simulator.py"]
    adt_ui_competitor_radar["adt_ui/competitor_radar.py"]
    adt_ui_strategy_builder["adt_ui/strategy_builder.py"]
    adt_agents_orchestrator --> adt_core_campaign_crud
    adt_agents_orchestrator --> adt_core_campaign_builder
    adt_agents_orchestrator --> adt_core_keyword_router
    adt_agents_orchestrator --> adt_core_bidding_engine
    adt_agents_orchestrator --> adt_dspy_debate_module
    adt_agents_orchestrator --> adt_tools_google_ads_connector
    adt_agents_orchestrator --> adt_tools_amazon_ads_connector
    adt_core_campaign_builder --> adt_core_campaign_crud
    adt_core_campaign_builder --> adt_core_keyword_router
    adt_core_bidding_engine --> adt_core_campaign_crud
    adt_core_bidding_engine --> adt_dspy_debate_module
    adt_core_portfolio_optimizer --> adt_core_campaign_crud
    adt_core_portfolio_optimizer --> adt_dspy_signature_optimizer
    adt_dspy_debate_module --> adt_dspy_reasoning_tracer
    adt_tools_google_ads_connector --> adt_tools_data_studio_reporter
    adt_tools_amazon_ads_connector --> adt_tools_data_studio_reporter
    adt_tools_competitor_intel --> adt_tools_google_ads_connector
    adt_ui_streamlit_app --> adt_ui_dashboard
    adt_ui_streamlit_app --> adt_ui_portfolio_view
    adt_ui_streamlit_app --> adt_ui_keyword_lab
    adt_ui_streamlit_app --> adt_ui_bid_simulator
    adt_ui_streamlit_app --> adt_ui_competitor_radar
    adt_ui_streamlit_app --> adt_ui_strategy_builder
    adt_ui_streamlit_app --> adt_agents_orchestrator
    adt_ui_dashboard --> adt_tools_data_studio_reporter
    adt_ui_portfolio_view --> adt_core_portfolio_optimizer
    adt_ui_keyword_lab --> adt_core_keyword_router
    adt_ui_bid_simulator --> adt_core_bidding_engine
    adt_ui_competitor_radar --> adt_tools_competitor_intel
    adt_ui_strategy_builder --> adt_dspy_signature_optimizer
\`\`\`
