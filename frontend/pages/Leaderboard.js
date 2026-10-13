
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('liveLeaderboard');
    if (!root) return;

    const css = document.createElement('style');
    css.textContent = `
        .rank-board {
            background: #152238;
            color: #f8fafc;
            border-radius: 18px;
            padding: 24px;
            margin: 16px 0 32px;
        }

        .rank-board h2,
        .rank-board h3 {
            color: #fff;
            margin: 0 0 12px;
        }

        .rank-heading {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 22px;
        }

        .rank-subtitle {
            color: #b7c5da;
            margin: 6px 0 0;
        }

        .rank-refresh {
            border: 0;
            background: #2563eb;
            color: white;
            border-radius: 8px;
            padding: 10px 16px;
            cursor: pointer;
        }

        .rank-podium {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 26px;
        }

        .rank-card {
            background: #263852;
            border: 1px solid #3a506d;
            border-radius: 12px;
            text-align: center;
            padding: 18px 8px;
            overflow-wrap: anywhere;
        }

        .rank-card:first-child {
            border-color: #eab308;
            background: #37321f;
        }

        .rank-medal {
            font-size: 32px;
        }

        .rank-player {
            font-weight: 700;
            margin: 8px 0;
        }

        .rank-xp {
            color: #facc15;
            font-weight: 700;
        }

        .rank-scroll {
            overflow-x: auto;
            margin-bottom: 28px;
        }

        .rank-table {
            border-collapse: collapse;
            width: 100%;
            min-width: 830px;
        }

        .rank-table th {
            text-align: left;
            background: #2b405d;
            color: #e2e8f0;
            padding: 13px;
        }

        .rank-table td {
            padding: 13px;
            border-bottom: 1px solid #37465c;
        }

        .rank-table tbody tr:hover {
            background: #233650;
        }

        .rank-match {
            background: #24344d;
            border-radius: 12px;
            padding: 17px;
            margin: 12px 0;
        }

        .rank-versus {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 12px;
            align-items: center;
            text-align: center;
        }

        .rank-versus strong {
            font-size: 18px;
        }

        .rank-versus small {
            display: block;
            color: #b7c5da;
            margin-top: 6px;
        }

        .rank-winner {
            color: #86efac;
        }

        .rank-versus-label {
            color: #facc15;
            font-weight: 700;
        }

        .rank-detail {
            color: #b7c5da;
            font-size: 13px;
            margin-top: 12px;
            text-align: center;
        }

        .rank-note {
            color: #b7c5da;
            font-size: 13px;
            margin-top: 16px;
        }

        .rank-empty {
            color: #b7c5da;
            padding: 22px;
            text-align: center;
        }

        .rank-error {
            background: #542b32;
            color: #fecaca;
            padding: 16px;
            border-radius: 10px;
        }

        @media (max-width: 600px) {
            .rank-board {
                padding: 14px;
            }

            .rank-podium {
                gap: 6px;
            }

            .rank-card {
                padding: 12px 5px;
            }

            .rank-versus strong {
                font-size: 14px;
            }
        }
    `;

    document.head.appendChild(css);

    let guestReady = false;
    let busy = false;
    let rendered = false;

    const el = (tag, cls, content) => {
        const node = document.createElement(tag);

        if (cls) node.className = cls;

        if (content !== undefined && content !== null) {
            node.textContent = String(content);
        }

        return node;
    };

    const num = value => {
        if (
            value === undefined ||
            value === null ||
            value === '' ||
            !Number.isFinite(Number(value))
        ) {
            return '—';
        }

        return Number(value).toLocaleString();
    };

    const pct = value => {
        if (
            value === undefined ||
            value === null ||
            !Number.isFinite(Number(value))
        ) {
            return '—';
        }

        return Number(value).toFixed(1) + '%';
    };

    const name = player => player.nickname || 'Player';

    function table(players) {
        const wrap = el('div', 'rank-scroll');
        const table = el('table', 'rank-table');
        const thead = el('thead');
        const headerRow = el('tr');

        [
            'Rank',
            'Player',
            'Wins',
            'Losses',
            'Draws',
            'Win rate',
            'Accuracy',
            'Best streak',
            'Score',
            'XP',
            'Level'
        ].forEach(label => {
            const th = el('th', '', label);
            th.scope = 'col';
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const body = el('tbody');

        players.forEach((player, index) => {
            const row = el('tr');

            const values = [
                player.rank || index + 1,
                name(player),
                num(player.wins),
                num(player.losses),
                num(player.draws),
                pct(player.winRate),
                pct(player.accuracy),
                num(player.bestStreak),
                num(player.totalScore),
                num(player.totalXp),
                num(player.level)
            ];

            values.forEach((value, column) => {
                const cell = el(
                    'td',
                    column === 9 ? 'rank-xp' : '',
                    value
                );

                row.appendChild(cell);
            });

            body.appendChild(row);
        });

        table.appendChild(body);
        wrap.appendChild(table);

        return wrap;
    }

    function matches(records) {
        const section = el('section');

        section.appendChild(
            el('h3', '', 'Recent 1v1 Battles')
        );

        if (!records.length) {
            section.appendChild(
                el(
                    'p',
                    'rank-empty',
                    'No completed player-versus-player matches yet.'
                )
            );

            return section;
        }

        records.forEach(match => {
            const card = el('article', 'rank-match');
            const versus = el('div', 'rank-versus');

            [match.player1, match.player2].forEach((player, index) => {
                if (index === 1) {
                    versus.appendChild(
                        el('span', 'rank-versus-label', 'VS')
                    );
                }

                const side = el('div');

                side.appendChild(
                    el(
                        'strong',
                        player.result === 'win' ? 'rank-winner' : '',
                        player.nickname || 'Player'
                    )
                );

                side.appendChild(
                    el('div', '', num(player.score) + ' points')
                );

                side.appendChild(
                    el(
                        'small',
                        '',
                        player.result === 'win'
                            ? '🏆 Winner'
                            : player.result === 'draw'
                                ? 'Draw'
                                : 'Defeated'
                    )
                );

                versus.appendChild(side);
            });

            card.appendChild(versus);

            const details = [];

            if (match.endedAt) {
                const date = new Date(match.endedAt);

                if (!Number.isNaN(date.valueOf())) {
                    details.push(date.toLocaleString());
                }
            }

            if (
                match.player1.accuracy !== null &&
                match.player1.accuracy !== undefined &&
                match.player2.accuracy !== null &&
                match.player2.accuracy !== undefined
            ) {
                details.push(
                    'Accuracy: ' +
                    pct(match.player1.accuracy) +
                    ' vs ' +
                    pct(match.player2.accuracy)
                );
            }

            if (
                match.player1.longestStreak != null &&
                match.player2.longestStreak != null
            ) {
                details.push(
                    'Best streak: ' +
                    num(match.player1.longestStreak) +
                    ' vs ' +
                    num(match.player2.longestStreak)
                );
            }

            if (details.length) {
                card.appendChild(
                    el('div', 'rank-detail', details.join('  •  '))
                );
            }

            section.appendChild(card);
        });

        return section;
    }

    function render(data) {
        const board = el('section', 'rank-board');
        const heading = el('div', 'rank-heading');
        const left = el('div');

        left.appendChild(
            el('h2', '', '🏆 Hall of Champions')
        );

        left.appendChild(
            el(
                'p',
                'rank-subtitle',
                '1v1 rankings • victories, maths accuracy and XP'
            )
        );

        const refresh = el(
            'button',
            'rank-refresh',
            'Refresh rankings'
        );

        refresh.type = 'button';
        refresh.addEventListener('click', load);

        heading.append(left, refresh);
        board.appendChild(heading);

        const players = data.players || [];

        if (players.length) {
            const podium = el('div', 'rank-podium');

            players.slice(0, 3).forEach((player, index) => {
                const card = el('div', 'rank-card');

                card.appendChild(
                    el('div', 'rank-medal', ['🥇', '🥈', '🥉'][index])
                );

                card.appendChild(
                    el('div', 'rank-player', name(player))
                );

                card.appendChild(
                    el(
                        'div',
                        'rank-xp',
                        num(player.totalXp) + ' XP'
                    )
                );

                card.appendChild(
                    el(
                        'div',
                        '',
                        num(player.wins) +
                        ' wins • Level ' +
                        num(player.level)
                    )
                );

                podium.appendChild(card);
            });

            board.appendChild(podium);
            board.appendChild(table(players));
        } else {
            board.appendChild(
                el(
                    'p',
                    'rank-empty',
                    'No players ranked yet. Finish a game to get started.'
                )
            );
        }

        board.appendChild(
            matches(data.recentMatches || [])
        );

        board.appendChild(
            el(
                'p',
                'rank-note',
                'Only completed PvP matches count towards wins, ' +
                'losses and match statistics. XP is your total game progression.'
            )
        );

        root.replaceChildren(board);
        rendered = true;
    }

    async function load() {
        if (busy) return;

        busy = true;

        try {
            if (!guestReady) {
                await MTOWApi.ensureGuest();
                guestReady = true;
            }

            const data = await MTOWApi.request(
                '/competition-leaderboard'
            );

            if (!data || !Array.isArray(data.players)) {
                throw new Error('Unexpected server response');
            }

            render(data);
        } catch (error) {
            console.error(error);

            if (!rendered) {
                root.replaceChildren(
                    el(
                        'p',
                        'rank-error',
                        'Unable to load leaderboard: ' + error.message
                    )
                );
            }
        } finally {
            busy = false;
        }
    }

    load();

    setInterval(() => {
        if (!document.hidden) {
            load();
        }
    }, 10000);
});
