#!/usr/bin/env python3
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
import os
import numpy as np
from pathlib import Path

matplotlib.use('Agg')
plt.style.use('seaborn-v0_8-whitegrid')

CSV_DIR = Path('/home/oussama/Documents/yelp-big-data-analysis/results/csv')
OUTPUT_DIR = Path('/home/oussama/Documents/yelp-big-data-analysis/results/charts')
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)

TITLE_MAP = {
    'E01': ('Top Merchants', 'Number of Businesses', 'Merchant Name'),
    'E02': ('Top Cities', 'Number of Businesses', 'City'),
    'E03': ('Top States', 'Number of Businesses', 'State'),
    'E04': ('Average Rating', 'Average Rating', 'Rating'),
    'E05': ('Category Count', 'Total Categories', 'Count'),
    'E06': ('Top Categories', 'Number of Businesses', 'Category'),
    'E07': ('Five Star Merchants', 'Five Star Reviews', 'Merchant'),
    'E08': ('Restaurant Types', 'Number of Restaurants', 'Type'),
    'E09': ('Reviews per Type', 'Number of Reviews', 'Type'),
    'E10': ('Rating Distribution', 'Number of Reviews', 'Rating'),
    'E11': ('Turnaround Merchants', 'Turnaround Time (days)', 'Merchant'),
    'E12': ('Category Synergy', 'Synergy Score', 'Category Pair'),
    'E13': ('Polarizing Business', 'Rating Std Dev', 'Business'),
    'E14': ('Users per Year', 'Number of Users', 'Year'),
    'E15': ('Top Reviewers', 'Review Count', 'User'),
    'E16': ('Popular Users', 'Total Reviews', 'User'),
    'E17': ('Elite Ratio', 'Elite Users %', 'Year'),
    'E18': ('Silent Users', 'Number of Users', 'Users'),
    'E19': ('Review Count per Year', 'Count', 'Year'),
    'E20': ('Common Words', 'Frequency', 'Word'),
    'E21': ('Positive Words', 'Frequency', 'Word'),
    'E22': ('Negative Words', 'Frequency', 'Word'),
    'E23': ('Checkins per Year', 'Checkin Count', 'Year'),
    'E24': ('Checkins per Hour', 'Checkin Count', 'Hour'),
    'E25': ('Popular City', 'Number of Checkins', 'City'),
    'E26': ('Rating Distribution', 'Number of Reviews', 'Rating'),
    'E27': ('Weekend vs Weekday', 'Checkin Count', 'Day Type'),
    'E28': ('Top Merchants per City', 'Number of Reviews', 'City'),
    'E29': ('Conversion Rate', 'Conversion Rate %', 'Category'),
    'E30': ('Download Weather Data', 'Weather Data', 'Data'),
    'E31': ('Merge Weather + Yelp', 'Merged Records', 'Data'),
    'E32': ('Weather vs Rating', 'Correlation', 'Weather Metric'),
    'E33': ('Weather vs Checkin', 'Correlation', 'Weather Metric'),
    'E34': ('Detect Cursed Locations', 'Cursed Score', 'Location'),
    'E35': ('Analyze Attributes', 'Attribute Count', 'Attribute'),
    'E36': ('Review NLP', 'NLP Score', 'Metric'),
    'E37': ('External Map Data', 'Data Points', 'Source'),
    'E38': ('Fake Review Detection', 'Fake Score', 'Metric'),
    'E39': ('User Behavior Analysis', 'Behavior Score', 'Metric'),
    'E40': ('Timeline Analysis', 'Timeline Data', 'Time'),
}

def get_chart_type(df, filename):
    cols = df.columns.tolist()
    n_rows = len(df)
    
    if n_rows <= 1 or df.empty:
        return 'text', None
    
    if n_rows <= 5 and any('year' in c.lower() for c in cols):
        return 'line', None
    
    if any('year' in c.lower() for c in cols) or any('date' in c.lower() for c in cols):
        return 'line', None
    
    if n_rows > 15:
        return 'horizontal_bar', None
    
    if 'cnt' in cols or 'count' in [c.lower() for c in cols]:
        return 'bar', None
    
    if any('pct' in c.lower() or 'percent' in c.lower() or 'rate' in c.lower() for c in cols):
        return 'bar', None
    
    return 'bar', None

def determine_title(cols, filename):
    file_num = filename.split('-')[-1].replace('.csv', '')
    if file_num in TITLE_MAP:
        return TITLE_MAP[file_num]
    
    for col in cols:
        if 'name' in col.lower():
            return (f'Analysis {file_num}', col.replace('_', ' ').title(), 'Value')
    return (f'Analysis {file_num}', 'Value', 'Category')

def create_chart(df, filename, output_path):
    if df.empty or len(df) <= 1:
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.text(0.5, 0.5, 'No sufficient data', ha='center', va='center', fontsize=16)
        ax.axis('off')
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return
    
    cols = df.columns.tolist()
    title_base, y_label, x_label = determine_title(cols, filename)
    chart_type = get_chart_type(df, filename)
    
    fig, ax = plt.subplots(figsize=(14, 8))
    
    num_cols = [c for c in cols if c not in [cols[0]] and df[c].dtype in ['int64', 'float64']]
    
    if not num_cols:
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.text(0.5, 0.5, 'No numeric data to plot', ha='center', va='center', fontsize=16)
        ax.axis('off')
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return
    
    y_col = num_cols[0]
    x_col = cols[0]
    
    x_data = df[x_col].astype(str).tolist()
    y_data = df[y_col].tolist()
    
    colors = plt.cm.viridis(np.linspace(0.2, 0.8, len(x_data)))
    
    if chart_type == 'horizontal_bar':
        bars = ax.barh(x_data, y_data, color=colors)
        ax.set_xlabel(y_label, fontsize=12)
        ax.set_ylabel(x_label, fontsize=12)
        ax.invert_yaxis()
    else:
        bars = ax.bar(x_data, y_data, color=colors)
        ax.set_xlabel(x_label, fontsize=12)
        ax.set_ylabel(y_label, fontsize=12)
        ax.tick_params(axis='x', rotation=45)
    
    for bar, val in zip(bars, y_data):
        height = bar.get_height()
        if chart_type == 'horizontal_bar':
            ax.text(bar.get_width() + bar.get_width()*0.01, bar.get_y() + bar.get_height()/2,
                   f'{val:,.0f}', va='center', fontsize=9)
        else:
            ax.text(bar.get_x() + bar.get_width()/2, height + height*0.01,
                   f'{val:,.0f}', ha='center', va='bottom', fontsize=9)
    
    ax.set_title(title_base, fontsize=16, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()

def main():
    csv_files = sorted(CSV_DIR.glob('*.csv'))
    
    for csv_file in csv_files:
        filename = csv_file.name
        print(f"Processing: {filename}")
        
        try:
            df = pd.read_csv(csv_file, encoding='utf-8-sig')
        except Exception as e:
            print(f"  Error reading {filename}: {e}")
            continue
        
        output_name = filename.replace('.csv', '.png')
        output_path = OUTPUT_DIR / output_name
        
        create_chart(df, filename, output_path)
        print(f"  Saved: {output_name}")

if __name__ == '__main__':
    main()
