"""Seed the chatbot_knowledge table with 20 core articles (10 EN + 10 EL)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.chatbot import ChatbotKnowledge

ARTICLES = [
    {
        "topic": "How to create a task",
        "tags": ["tasks", "create", "how-to"],
        "language": "en",
        "content": (
            "To create a new task, navigate to the Tasks section from the sidebar. "
            "Click the Create Task or + button at the top of the page. "
            "Fill in the task title, an optional description, and select the urgency label that fits "
            "(see \"Understanding urgency labels\"). Set a due date if the task has a deadline. "
            "Assign the task to a user or team — for non-Admin users, you can only assign to people in your branch. "
            "Save the task. The assignee will receive a notification. "
            "The task starts in \"New\" status and progresses through the status flow as work is done."
        ),
    },
    {
        "topic": "Πώς να δημιουργήσετε μια εργασία",
        "tags": ["tasks", "create", "how-to"],
        "language": "el",
        "content": (
            "Για να δημιουργήσετε μια νέα εργασία, μεταβείτε στην ενότητα Tasks από την πλαϊνή μπάρα. "
            "Κάντε κλικ στο κουμπί δημιουργίας στο πάνω μέρος της σελίδας. "
            "Συμπληρώστε τον τίτλο της εργασίας, μια προαιρετική περιγραφή και επιλέξτε την κατάλληλη ετικέτα επείγοντος "
            "(δείτε «Κατανόηση των ετικετών επείγοντος»). Ορίστε ημερομηνία λήξης αν υπάρχει προθεσμία. "
            "Αναθέστε την εργασία σε χρήστη ή ομάδα — οι μη-Admin χρήστες μπορούν να αναθέσουν μόνο σε άτομα του κλάδου τους. "
            "Αποθηκεύστε την εργασία. Ο παραλήπτης θα λάβει ειδοποίηση. "
            "Η εργασία ξεκινά σε κατάσταση «New» και προχωρά μέσα από τη ροή καταστάσεων καθώς εκτελείται."
        ),
    },
    {
        "topic": "Understanding urgency labels",
        "tags": ["tasks", "urgency", "priorities"],
        "language": "en",
        "content": (
            "The BWC Task Manager uses 5 urgency labels to prioritize work:\n\n"
            "- Urgent & Important (red) — top priority, deal with immediately\n"
            "- Urgent (blue) — time-sensitive but less critical\n"
            "- Important (green) — matters but no immediate deadline\n"
            "- Not Urgent & Not Important (yellow) — low priority. This is the ONLY label whose tasks can be transferred between users.\n"
            "- Same-day auto (orange) — automatically applied to tasks created with a same-day due date\n\n"
            "The label drives the visual color of the task card across the app. "
            "Choose deliberately — wrong labels make priority tracking less useful for the whole team."
        ),
    },
    {
        "topic": "Κατανόηση των ετικετών επείγοντος",
        "tags": ["tasks", "urgency", "priorities"],
        "language": "el",
        "content": (
            "Το BWC Task Manager χρησιμοποιεί 5 ετικέτες επείγοντος για την προτεραιοποίηση εργασιών:\n\n"
            "- Urgent & Important (κόκκινο) — μέγιστη προτεραιότητα, άμεση ενέργεια\n"
            "- Urgent (μπλε) — χρονικά κρίσιμο αλλά λιγότερο σημαντικό\n"
            "- Important (πράσινο) — έχει σημασία αλλά χωρίς άμεση προθεσμία\n"
            "- Not Urgent & Not Important (κίτρινο) — χαμηλή προτεραιότητα. Είναι η ΜΟΝΗ ετικέτα που επιτρέπει τη μεταφορά εργασιών μεταξύ χρηστών.\n"
            "- Same-day auto (πορτοκαλί) — εφαρμόζεται αυτόματα σε εργασίες με ημερομηνία λήξης την ίδια ημέρα\n\n"
            "Η ετικέτα καθορίζει το χρώμα της κάρτας της εργασίας σε όλη την εφαρμογή. "
            "Επιλέξτε με προσοχή — λάθος ετικέτες κάνουν τη διαχείριση προτεραιοτήτων λιγότερο χρήσιμη για όλη την ομάδα."
        ),
    },
    {
        "topic": "Task status flow",
        "tags": ["tasks", "status", "workflow"],
        "language": "en",
        "content": (
            "Tasks move through a defined status flow:\n\n"
            "1. New — just created, not yet acknowledged by the assignee\n"
            "2. Received — assignee has seen the task and accepted it\n"
            "3. On Process — work is actively happening\n"
            "4. Pending — work is blocked by something external (waiting on a third party, missing info)\n"
            "5. Completed — task is done. This is a terminal state.\n"
            "6. Loose End — task wasn't completed and won't be, but isn't being deleted (kept for record-keeping)\n\n"
            "Move the status as your work progresses. \"On Process\" and \"Pending\" are mid-flight states; "
            "either can transition to \"Completed\" or \"Loose End\". "
            "Once a task is \"Completed\", it cannot be reopened — create a new task if more work is needed."
        ),
    },
    {
        "topic": "Ροή καταστάσεων εργασίας",
        "tags": ["tasks", "status", "workflow"],
        "language": "el",
        "content": (
            "Οι εργασίες περνούν από μια καθορισμένη ροή καταστάσεων:\n\n"
            "1. New — μόλις δημιουργήθηκε, δεν έχει ακόμα αναγνωριστεί από τον παραλήπτη\n"
            "2. Received — ο παραλήπτης έχει δει και αποδεχτεί την εργασία\n"
            "3. On Process — η εργασία εκτελείται ενεργά\n"
            "4. Pending — η εργασία είναι μπλοκαρισμένη από κάτι εξωτερικό (αναμονή τρίτου, ελλιπείς πληροφορίες)\n"
            "5. Completed — η εργασία ολοκληρώθηκε. Τερματική κατάσταση.\n"
            "6. Loose End — δεν ολοκληρώθηκε και δεν θα ολοκληρωθεί, αλλά δεν διαγράφεται (διατηρείται για το αρχείο)\n\n"
            "Αλλάξτε την κατάσταση καθώς εξελίσσεται η εργασία σας. "
            "Οι «On Process» και «Pending» είναι ενδιάμεσες· οποιαδήποτε μπορεί να περάσει σε «Completed» ή «Loose End». "
            "Μόλις μια εργασία είναι «Completed», δεν μπορεί να ανοίξει ξανά — δημιουργήστε νέα εργασία αν χρειάζεται περισσότερη δουλειά."
        ),
    },
    {
        "topic": "How to transfer a task",
        "tags": ["tasks", "transfer", "assignment"],
        "language": "en",
        "content": (
            "Tasks can be transferred from one user to another, but ONLY tasks with the urgency label "
            "\"Not Urgent & Not Important\" (yellow). This restriction prevents urgent work from getting passed around without accountability.\n\n"
            "To transfer a Not Urgent & Not Important task:\n"
            "1. Open the task detail view\n"
            "2. Find the transfer option (usually next to the assignee field)\n"
            "3. Select the user you want to transfer to — for non-Admin users, only users within your branch are eligible\n"
            "4. Confirm\n\n"
            "The new assignee will receive a notification. Higher-urgency tasks can be reassigned by an Admin or a hierarchy manager "
            "(Head/Manager/Pillar) via the standard assignment edit, but the transfer button itself only works for yellow-label tasks."
        ),
    },
    {
        "topic": "Πώς να μεταφέρετε μια εργασία",
        "tags": ["tasks", "transfer", "assignment"],
        "language": "el",
        "content": (
            "Οι εργασίες μπορούν να μεταφερθούν από έναν χρήστη σε άλλο, αλλά ΜΟΝΟ εργασίες με ετικέτα επείγοντος "
            "«Not Urgent & Not Important» (κίτρινο). Ο περιορισμός υπάρχει για να αποτραπεί το πέρασμα επείγουσας δουλειάς "
            "από χέρι σε χέρι χωρίς ευθύνη.\n\n"
            "Για να μεταφέρετε μια εργασία Not Urgent & Not Important:\n"
            "1. Ανοίξτε τη λεπτομερή προβολή της εργασίας\n"
            "2. Βρείτε την επιλογή μεταφοράς (συνήθως δίπλα στο πεδίο αναθέτη)\n"
            "3. Επιλέξτε τον χρήστη στον οποίο θέλετε να μεταφέρετε — για μη-Admin χρήστες, μόνο χρήστες του κλάδου σας είναι επιλέξιμοι\n"
            "4. Επιβεβαιώστε\n\n"
            "Ο νέος αναθέτης θα λάβει ειδοποίηση. Εργασίες υψηλότερης προτεραιότητας μπορούν να ανατεθούν εκ νέου από Admin ή "
            "hierarchy manager (Head/Manager/Pillar) μέσω της κανονικής επεξεργασίας ανάθεσης, αλλά το ίδιο το κουμπί μεταφοράς "
            "λειτουργεί μόνο για κίτρινες εργασίες."
        ),
    },
    {
        "topic": "How to mark a task as complete",
        "tags": ["tasks", "complete", "status"],
        "language": "en",
        "content": (
            "To mark a task as complete:\n"
            "1. Open the task by clicking it from any task list or the dashboard\n"
            "2. The task detail drawer opens on the right side\n"
            "3. Change the status to \"Completed\"\n"
            "4. Save\n\n"
            "The task disappears from open-task lists but remains in the database for reporting. "
            "\"Completed\" is a terminal state — the task cannot move out of it. "
            "If you need to revisit the work, create a new task and reference the completed one in its description. "
            "Completion timestamps are recorded automatically and contribute to your stats and your team's workload reports."
        ),
    },
    {
        "topic": "Πώς να σημειώσετε εργασία ως ολοκληρωμένη",
        "tags": ["tasks", "complete", "status"],
        "language": "el",
        "content": (
            "Για να σημειώσετε μια εργασία ως ολοκληρωμένη:\n"
            "1. Ανοίξτε την εργασία κάνοντας κλικ από οποιαδήποτε λίστα εργασιών ή από το dashboard\n"
            "2. Ανοίγει η λεπτομερής προβολή στη δεξιά πλευρά\n"
            "3. Αλλάξτε την κατάσταση σε «Completed»\n"
            "4. Αποθηκεύστε\n\n"
            "Η εργασία εξαφανίζεται από τις λίστες ανοιχτών εργασιών αλλά παραμένει στη βάση δεδομένων για αναφορές. "
            "Το «Completed» είναι τερματική κατάσταση — η εργασία δεν μπορεί να βγει από εκεί. "
            "Αν χρειάζεται να ξανα-ασχοληθείτε, δημιουργήστε νέα εργασία και αναφερθείτε στην ολοκληρωμένη στην περιγραφή. "
            "Οι χρονοσφραγίδες ολοκλήρωσης καταγράφονται αυτόματα και συνεισφέρουν στα stats σας και στις αναφορές φόρτου εργασίας της ομάδας."
        ),
    },
    {
        "topic": "Understanding the role hierarchy",
        "tags": ["hierarchy", "roles", "permissions"],
        "language": "en",
        "content": (
            "The BWC Task Manager has 5 user roles, in strict order from highest to lowest:\n\n"
            "1. Admin — sees everything across the entire organization, can manage all users\n"
            "2. Pillar — sees everything in their branch; acts as \"admin for their branch\"\n"
            "3. Manager — manages a group of Heads and Agents\n"
            "4. Head — manages Agents\n"
            "5. Agent — does the work, has no subordinates\n\n"
            "Each user (except Admin) has exactly one parent. Visibility follows the tree: a user sees only themselves + all descendants "
            "in their branch. So a Manager only sees their Heads and the Heads' Agents — not other Managers' branches.\n\n"
            "Account creation follows the same rule: Admins can create anyone; Pillars can create Manager/Head/Agent; "
            "Managers can create Head/Agent; Heads can create only Agents; Agents cannot create users."
        ),
    },
    {
        "topic": "Κατανόηση της ιεραρχίας ρόλων",
        "tags": ["hierarchy", "roles", "permissions"],
        "language": "el",
        "content": (
            "Το BWC Task Manager έχει 5 ρόλους χρηστών, σε αυστηρή σειρά από τον υψηλότερο στον χαμηλότερο:\n\n"
            "1. Admin — βλέπει τα πάντα σε όλο τον οργανισμό, διαχειρίζεται όλους τους χρήστες\n"
            "2. Pillar — βλέπει τα πάντα στον κλάδο του· λειτουργεί ως «admin του κλάδου»\n"
            "3. Manager — διαχειρίζεται μια ομάδα από Heads και Agents\n"
            "4. Head — διαχειρίζεται Agents\n"
            "5. Agent — εκτελεί την εργασία, δεν έχει υφισταμένους\n\n"
            "Κάθε χρήστης (εκτός από τον Admin) έχει ακριβώς έναν γονέα. Η ορατότητα ακολουθεί το δέντρο: ένας χρήστης βλέπει "
            "μόνο τον εαυτό του + όλους τους απογόνους του στον κλάδο του. Έτσι ένας Manager βλέπει μόνο τα δικά του Heads και "
            "τους Agents τους — όχι τους κλάδους άλλων Managers.\n\n"
            "Η δημιουργία λογαριασμών ακολουθεί τον ίδιο κανόνα: οι Admins δημιουργούν οποιονδήποτε· οι Pillars δημιουργούν "
            "Manager/Head/Agent· οι Managers Head/Agent· οι Heads μόνο Agents· οι Agents δεν μπορούν να δημιουργήσουν χρήστες."
        ),
    },
    {
        "topic": "How to create a project",
        "tags": ["projects", "create", "how-to"],
        "language": "en",
        "content": (
            "To create a new project:\n"
            "1. Navigate to Projects from the sidebar\n"
            "2. Click the create button\n"
            "3. Enter a project name (required) and description (optional)\n"
            "4. Set the initial status — usually \"Active\" or \"Planning\"\n"
            "5. Assign an owner or project manager if applicable\n"
            "6. Save\n\n"
            "Once created, you can attach tasks to the project from the task creation form. "
            "Projects help group related work and provide aggregate reporting (open task counts, completion rates). "
            "Like all data in the app, projects are scoped to your branch — non-Admin users see only projects within their visibility tree."
        ),
    },
    {
        "topic": "Πώς να δημιουργήσετε ένα project",
        "tags": ["projects", "create", "how-to"],
        "language": "el",
        "content": (
            "Για να δημιουργήσετε ένα νέο project:\n"
            "1. Μεταβείτε στα Projects από την πλαϊνή μπάρα\n"
            "2. Κάντε κλικ στο κουμπί δημιουργίας\n"
            "3. Εισάγετε όνομα project (υποχρεωτικό) και περιγραφή (προαιρετικά)\n"
            "4. Ορίστε την αρχική κατάσταση — συνήθως «Active» ή «Planning»\n"
            "5. Αναθέστε owner ή project manager αν χρειάζεται\n"
            "6. Αποθηκεύστε\n\n"
            "Μετά τη δημιουργία, μπορείτε να συνδέσετε εργασίες με το project από τη φόρμα δημιουργίας εργασίας. "
            "Τα projects βοηθούν στην ομαδοποίηση σχετικής εργασίας και παρέχουν συγκεντρωτικές αναφορές "
            "(ανοιχτές εργασίες, ποσοστά ολοκλήρωσης). Όπως όλα τα δεδομένα στην εφαρμογή, τα projects έχουν εμβέλεια "
            "στον κλάδο σας — οι μη-Admin χρήστες βλέπουν μόνο projects εντός του δέντρου ορατότητάς τους."
        ),
    },
    {
        "topic": "How to add a contact",
        "tags": ["contacts", "create", "how-to"],
        "language": "en",
        "content": (
            "To add a new contact:\n"
            "1. Navigate to Contacts from the sidebar\n"
            "2. Click the create button\n"
            "3. Fill in name, email, phone, and any additional fields\n"
            "4. Save\n\n"
            "Contacts are PRIVATE to each user — they are not shared across the branch and even Admins do not see other users' contacts. "
            "This is by design: each user manages their own address book. "
            "If you need a shared contact list, use Companies instead, which DO follow the branch visibility rules.\n\n"
            "Use the search box on the Contacts page to find contacts quickly. "
            "The chatbot can also search your contacts — ask \"find contacts named X\" to query them via natural language."
        ),
    },
    {
        "topic": "Πώς να προσθέσετε μια επαφή",
        "tags": ["contacts", "create", "how-to"],
        "language": "el",
        "content": (
            "Για να προσθέσετε μια νέα επαφή:\n"
            "1. Μεταβείτε στις Contacts από την πλαϊνή μπάρα\n"
            "2. Κάντε κλικ στο κουμπί δημιουργίας\n"
            "3. Συμπληρώστε όνομα, email, τηλέφωνο και τυχόν πρόσθετα πεδία\n"
            "4. Αποθηκεύστε\n\n"
            "Οι επαφές είναι ΙΔΙΩΤΙΚΕΣ για κάθε χρήστη — δεν μοιράζονται στον κλάδο και ακόμη και οι Admins δεν βλέπουν τις "
            "επαφές άλλων χρηστών. Αυτό είναι σχεδιαστική επιλογή: κάθε χρήστης διαχειρίζεται το δικό του ευρετήριο. "
            "Αν χρειάζεστε κοινή λίστα επαφών, χρησιμοποιήστε Companies, που ΑΚΟΛΟΥΘΟΥΝ τους κανόνες ορατότητας του κλάδου.\n\n"
            "Χρησιμοποιήστε το κουτί αναζήτησης στη σελίδα Contacts για γρήγορη εύρεση. "
            "Ο chatbot μπορεί επίσης να ψάξει στις επαφές σας — ρωτήστε «βρες επαφές με όνομα X» για αναζήτηση σε φυσική γλώσσα."
        ),
    },
    {
        "topic": "How to use branch filtering",
        "tags": ["branch", "admin", "filter"],
        "language": "en",
        "content": (
            "Branch filtering is an Admin-only feature that scopes the entire app to a specific branch of the hierarchy. "
            "Useful for Admins who want to see \"just Pillar A's world\" without leaving the Admin account.\n\n"
            "To use branch filtering:\n"
            "1. Look for the branch dropdown in the top navbar (Admin only — non-Admin users don't see it because they're already scoped to their branch)\n"
            "2. Select a user who has descendants (usually a Pillar or Manager)\n"
            "3. The entire app — Tasks, Projects, Analytics, etc. — now shows data as if you were that user\n"
            "4. To return to seeing everything, clear the filter\n\n"
            "The filter persists across page navigation until you change it. "
            "Non-Admin users always see their own branch automatically — no filter needed."
        ),
    },
    {
        "topic": "Πώς να χρησιμοποιήσετε το branch filtering",
        "tags": ["branch", "admin", "filter"],
        "language": "el",
        "content": (
            "Το branch filtering είναι λειτουργία αποκλειστικά για Admin που εστιάζει όλη την εφαρμογή σε συγκεκριμένο κλάδο "
            "της ιεραρχίας. Χρήσιμο για Admins που θέλουν να δουν «μόνο τον κόσμο του Pillar A» χωρίς να βγουν από τον Admin λογαριασμό.\n\n"
            "Για να το χρησιμοποιήσετε:\n"
            "1. Δείτε το branch dropdown στην επάνω μπάρα (μόνο Admin — οι μη-Admin χρήστες δεν το βλέπουν γιατί είναι ήδη περιορισμένοι στον κλάδο τους)\n"
            "2. Επιλέξτε χρήστη με απογόνους (συνήθως Pillar ή Manager)\n"
            "3. Όλη η εφαρμογή — Tasks, Projects, Analytics κ.λπ. — εμφανίζει πλέον δεδομένα σαν να ήσασταν εκείνος ο χρήστης\n"
            "4. Για επιστροφή στην προβολή όλων, καθαρίστε το φίλτρο\n\n"
            "Το φίλτρο διατηρείται μεταξύ σελίδων μέχρι να αλλάξει. "
            "Οι μη-Admin χρήστες βλέπουν πάντα τον δικό τους κλάδο αυτόματα — δεν χρειάζεται φίλτρο."
        ),
    },
    {
        "topic": "Navigating the app",
        "tags": ["navigation", "ui", "overview"],
        "language": "en",
        "content": (
            "The BWC Task Manager is organized around a left sidebar with these main sections:\n\n"
            "- Dashboard — overview of your work: open tasks, recent activity, upcoming deadlines\n"
            "- Tasks — full task list with filters and search\n"
            "- Projects — projects you can see, with their tasks\n"
            "- Contacts — your personal address book (private to you)\n"
            "- Companies — shared organizations (visible within your branch)\n"
            "- Chat — real-time messaging with your team\n"
            "- Notifications — assignments, status changes, comments\n"
            "- Analytics — charts and reports across your visible data\n"
            "- Admin (Admin role only) — user management, permissions, system settings\n\n"
            "The top navbar contains: your profile menu, language toggle (English/Greek), branch filter (Admin only), "
            "and the chatbot launcher (the gold floating button at bottom-right).\n\n"
            "Click any task in any list to open the detail drawer on the right — most actions happen there without leaving the current page."
        ),
    },
    {
        "topic": "Πλοήγηση στην εφαρμογή",
        "tags": ["navigation", "ui", "overview"],
        "language": "el",
        "content": (
            "Το BWC Task Manager είναι οργανωμένο γύρω από μια αριστερή πλαϊνή μπάρα με αυτές τις βασικές ενότητες:\n\n"
            "- Dashboard — επισκόπηση της εργασίας σας: ανοιχτές εργασίες, πρόσφατη δραστηριότητα, επερχόμενες προθεσμίες\n"
            "- Tasks — πλήρης λίστα εργασιών με φίλτρα και αναζήτηση\n"
            "- Projects — projects που βλέπετε, με τις εργασίες τους\n"
            "- Contacts — το προσωπικό σας ευρετήριο επαφών (ιδιωτικό σε εσάς)\n"
            "- Companies — κοινόχρηστοί οργανισμοί (ορατοί εντός του κλάδου σας)\n"
            "- Chat — άμεση επικοινωνία με την ομάδα σας\n"
            "- Notifications — αναθέσεις, αλλαγές καταστάσεων, σχόλια\n"
            "- Analytics — γραφήματα και αναφορές πάνω στα ορατά δεδομένα σας\n"
            "- Admin (μόνο για ρόλο Admin) — διαχείριση χρηστών, δικαιωμάτων, ρυθμίσεις συστήματος\n\n"
            "Η επάνω μπάρα περιέχει: το μενού προφίλ σας, εναλλαγή γλώσσας (Αγγλικά/Ελληνικά), branch filter (μόνο Admin) "
            "και τον launcher του chatbot (το χρυσό κουμπί κάτω-δεξιά).\n\n"
            "Κάντε κλικ σε οποιαδήποτε εργασία οποιασδήποτε λίστας για να ανοίξει η λεπτομερής προβολή στα δεξιά — "
            "οι περισσότερες ενέργειες γίνονται εκεί χωρίς να φύγετε από την τρέχουσα σελίδα."
        ),
    },
]


def main():
    db = SessionLocal()
    try:
        inserted = 0
        updated = 0
        now = datetime.now(timezone.utc)

        for article in ARTICLES:
            existing = (
                db.query(ChatbotKnowledge)
                .filter(
                    ChatbotKnowledge.topic == article["topic"],
                    ChatbotKnowledge.language == article["language"],
                )
                .first()
            )
            if existing:
                existing.content = article["content"]
                existing.tags = article["tags"]
                existing.updated_at = now
                updated += 1
            else:
                row = ChatbotKnowledge(
                    topic=article["topic"],
                    content=article["content"],
                    tags=article["tags"],
                    language=article["language"],
                )
                db.add(row)
                inserted += 1

        db.commit()

        total = db.query(ChatbotKnowledge).count()
        en_count = db.query(ChatbotKnowledge).filter(ChatbotKnowledge.language == "en").count()
        el_count = db.query(ChatbotKnowledge).filter(ChatbotKnowledge.language == "el").count()

        print(f"Inserted: {inserted}")
        print(f"Updated:  {updated}")
        print(f"Total rows in chatbot_knowledge: {total}")
        print(f"Distribution: EN={en_count}, EL={el_count}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
