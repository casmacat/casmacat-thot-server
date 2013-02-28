#!/usr/bin/perl -w

# Sample Tokenizer
### Based on moses tokenizer Version 1.1
# written by Pidong Wang, based on the code written by Josh Schroeder and Philipp Koehn

binmode(STDIN, ":utf8");
binmode(STDOUT, ":utf8");

use FindBin qw($RealBin);
use strict;
use Time::HiRes;
use Thread;
use utf8;

use Cwd 'abs_path';
use File::Basename;
my $dirname = abs_path(dirname(__FILE__));

#my $mydir = "$RealBin/../share/nonbreaking_prefixes";
my $mydir = "$dirname/nonbreaking_prefixes";

my %NONBREAKING_PREFIX = ();
my $language = "en";
my $QUIET = 0;
my $HELP = 0;
my $AGGRESSIVE = 0;
my $SKIP_XML = 0;
my $UPPERCASE_SENT = 0;

while (@ARGV) 
{
	$_ = shift;
	/^-b$/ && ($| = 1, next);
	/^-l$/ && ($language = shift, next);
	/^-q$/ && ($QUIET = 1, next);
	/^-h$/ && ($HELP = 1, next);
	/^-x$/ && ($SKIP_XML = 1, next);
	/^-a$/ && ($AGGRESSIVE = 1, next);
	/^-u$/ && ($UPPERCASE_SENT = 1, next);
}

if ($HELP) {
	print "Usage ./detokenizer.perl (-l [en|fr|it|cs|...]) < tokenizedfile > detokenizedfile\n";
        print "Options:\n";
        print "  -u  ... uppercase the first char in the final sentence.\n";
        print "  -q  ... don't report detokenizer revision.\n";
        print "  -b  ... disable Perl buffering.\n";
        print "  -a     ... aggressive hyphen splitting.\n";
	exit;
}

if ($language !~ /^(cs|en|fr|it)$/) {
  print STDERR "Warning: No built-in rules for language $language.\n"
}

# load the language-specific non-breaking prefix info from files in the directory nonbreaking_prefixes
load_prefixes($language,\%NONBREAKING_PREFIX);

if (scalar(%NONBREAKING_PREFIX) eq 0)
{
	print STDERR "Warning: No known abbreviations for language '$language'\n";
}

sub preprocess {
  my($text) = @_;
  chomp($text);

  #  #escape special chars
  #  $text =~ s/\&/\&amp;/g;   # escape escape
  #  $text =~ s/\|/\&#124;/g;  # factor separator
  #  $text =~ s/\</\&lt;/g;    # xml
  #  $text =~ s/\>/\&gt;/g;    # xml
  #  $text =~ s/\'/\&apos;/g;  # xml
  #  $text =~ s/\"/\&quot;/g;  # xml
  #  $text =~ s/\[/\&#91;/g;   # syntax non-terminal
  #  $text =~ s/\]/\&#93;/g;   # syntax non-terminal

  return $text;
}


# the actual tokenize function which tokenizes one input string
# input: one string
# return: the tokenized string for the input string
sub tokenize 
{
  my($text) = @_;
  chomp($text);
  $text = " $text ";
  
  # remove ASCII junk
  $text =~ s/\s+/ /g;
  $text =~ s/[\000-\037]//g;

  # seperate out all "other" special characters
  $text =~ s/([^\p{IsAlnum}\s\.\'\`\,\-])/ $1 /g;

  # aggressive hyphen splitting
  if ($AGGRESSIVE) 
  {
      $text =~ s/([\p{IsAlnum}])\-([\p{IsAlnum}])/$1 \@-\@ $2/g;
  }

  #multi-dots stay together
  $text =~ s/\.([\.]+)/ DOTMULTI$1/g;
  while($text =~ /DOTMULTI\./) 
  {
      $text =~ s/DOTMULTI\.([^\.])/DOTDOTMULTI $1/g;
      $text =~ s/DOTMULTI\./DOTDOTMULTI/g;
  }

  # seperate out "," except if within numbers (5,300)
  $text =~ s/([^\p{IsN}])[,]([^\p{IsN}])/$1 , $2/g;
  # separate , pre and post number
  $text =~ s/([\p{IsN}])[,]([^\p{IsN}])/$1 , $2/g;
  $text =~ s/([^\p{IsN}])[,]([\p{IsN}])/$1 , $2/g;
	    
  # turn `into '
  #$text =~ s/\`/\'/g;
	
  #turn '' into "
  #$text =~ s/\'\'/ \" /g;

  if ($language eq "en") 
  {
      #split contractions right
      $text =~ s/([^\p{IsAlpha}])[']([^\p{IsAlpha}])/$1 ' $2/g;
      $text =~ s/([^\p{IsAlpha}\p{IsN}])[']([\p{IsAlpha}])/$1 ' $2/g;
      $text =~ s/([\p{IsAlpha}])[']([^\p{IsAlpha}])/$1 ' $2/g;
      $text =~ s/([\p{IsAlpha}])[']([\p{IsAlpha}])/$1 '$2/g;
      #special case for "1990's"
      $text =~ s/([\p{IsN}])[']([s])/$1 '$2/g;
  } 
  elsif (($language eq "fr") or ($language eq "it")) 
  {
      #split contractions left	
      $text =~ s/([^\p{IsAlpha}])[']([^\p{IsAlpha}])/$1 ' $2/g;
      $text =~ s/([^\p{IsAlpha}])[']([\p{IsAlpha}])/$1 ' $2/g;
      $text =~ s/([\p{IsAlpha}])[']([^\p{IsAlpha}])/$1 ' $2/g;
      $text =~ s/([\p{IsAlpha}])[']([\p{IsAlpha}])/$1' $2/g;
  } 
  else 
  {
      $text =~ s/\'/ \' /g;
  }
	
  #word token method
  my @words = split(/\s/,$text);
  $text = "";
  for (my $i=0;$i<(scalar(@words));$i++) 
  {
      my $word = $words[$i];
      if ( $word =~ /^(\S+)\.$/) 
      {
          my $pre = $1;
          if (($pre =~ /\./ && $pre =~ /\p{IsAlpha}/) || ($NONBREAKING_PREFIX{$pre} && $NONBREAKING_PREFIX{$pre}==1) || ($i<scalar(@words)-1 && ($words[$i+1] =~ /^[\p{IsLower}]/))) 
          {
              #no change
		} 
          elsif (($NONBREAKING_PREFIX{$pre} && $NONBREAKING_PREFIX{$pre}==2) && ($i<scalar(@words)-1 && ($words[$i+1] =~ /^[0-9]+/))) 
          {
              #no change
          } 
          else 
          {
              $word = $pre." .";
          }
      }
      $text .= $word." ";
  }		

  # clean up extraneous spaces
  $text =~ s/ +/ /g;
  $text =~ s/^ //g;
  $text =~ s/ $//g;

  #restore multi-dots
  while($text =~ /DOTDOTMULTI/) 
  {
      $text =~ s/DOTDOTMULTI/DOTMULTI./g;
  }
  $text =~ s/DOTMULTI/./g;

  #escape special chars
  #$text =~ s/\&/\&amp;/g;   # escape escape
  #$text =~ s/\|/\&#124;/g;  # factor separator
  #$text =~ s/\</\&lt;/g;    # xml
  #$text =~ s/\>/\&gt;/g;    # xml
  #$text =~ s/\'/\&apos;/g;  # xml
  #$text =~ s/\"/\&quot;/g;  # xml
  #$text =~ s/\[/\&#91;/g;   # syntax non-terminal
  #$text =~ s/\]/\&#93;/g;   # syntax non-terminal

  #ensure final line break
  #$text .= "\n" unless $text =~ /\n$/;

  return $text;
}

sub load_prefixes 
{
    my ($language, $PREFIX_REF) = @_;
	
    my $prefixfile = "$mydir/nonbreaking_prefix.$language";
	
    #default back to English if we don't have a language-specific prefix file
    if (!(-e $prefixfile)) 
    {
        $prefixfile = "$mydir/nonbreaking_prefix.en";
        print STDERR "WARNING: No known abbreviations for language '$language', attempting fall-back to English version...\n";
        die ("ERROR: No abbreviations files found in $mydir\n") unless (-e $prefixfile);
    }
	
    if (-e "$prefixfile") 
    {
        open(PREFIX, "<:utf8", "$prefixfile");
        while (<PREFIX>) 
        {
            my $item = $_;
            chomp($item);
            if (($item) && (substr($item,0,1) ne "#")) 
            {
                if ($item =~ /(.*)[\s]+(\#NUMERIC_ONLY\#)/) 
                {
                    $PREFIX_REF->{$1} = 2;
                } 
                else 
                {
                    $PREFIX_REF->{$item} = 1;
                }
            }
        }
        close(PREFIX);
    }
}

sub ucsecondarg {
  # uppercase the second argument
  my $arg1 = shift;
  my $arg2 = shift;
  return $arg1.uc($arg2);
}


sub postprocess {
	my($text) = @_;
	chomp($text);
	$text = " $text ";
  $text =~ s/ \@\-\@ /-/g;
  # de-escape special chars
  $text =~ s/\&bar;/\|/g;   # factor separator (legacy)
  $text =~ s/\&#124;/\|/g;  # factor separator
  $text =~ s/\&lt;/\</g;    # xml
  $text =~ s/\&gt;/\>/g;    # xml
  $text =~ s/\&bra;/\[/g;   # syntax non-terminal (legacy)
  $text =~ s/\&ket;/\]/g;   # syntax non-terminal (legacy)
  $text =~ s/\&quot;/\"/g;  # xml
  $text =~ s/\&apos;/\'/g;  # xml
  $text =~ s/\&#91;/\[/g;   # syntax non-terminal
  $text =~ s/\&#93;/\]/g;   # syntax non-terminal
  $text =~ s/\&amp;/\&/g;   # escape escape

  return $text;
}

sub detokenize {
	my($text) = @_;
	chomp($text);
	$text = " $text ";
  $text =~ s/ \@\-\@ /-/g;
  # de-escape special chars
  #$text =~ s/\&bar;/\|/g;   # factor separator (legacy)
  #$text =~ s/\&#124;/\|/g;  # factor separator
  #$text =~ s/\&lt;/\</g;    # xml
  #$text =~ s/\&gt;/\>/g;    # xml
  #$text =~ s/\&bra;/\[/g;   # syntax non-terminal (legacy)
  #$text =~ s/\&ket;/\]/g;   # syntax non-terminal (legacy)
  #$text =~ s/\&quot;/\"/g;  # xml
  #$text =~ s/\&apos;/\'/g;  # xml
  #$text =~ s/\&#91;/\[/g;   # syntax non-terminal
  #$text =~ s/\&#93;/\]/g;   # syntax non-terminal
  #$text =~ s/\&amp;/\&/g;   # escape escape

	my $word;
	my $i;
	my @words = split(/ /,$text);
	$text = "";
	my %quoteCount =  ("\'"=>0,"\""=>0);
	my $prependSpace = " ";
	for ($i=0;$i<(scalar(@words));$i++) {		
		if (&startsWithCJKChar($words[$i])) {
		    if ($i > 0 && &endsWithCJKChar($words[$i-1])) {
			# perform left shift if this is a second consecutive CJK (Chinese/Japanese/Korean) word
			$text=$text.$words[$i];
		    } else {
			# ... but do nothing special if this is a CJK word that doesn't follow a CJK word
			$text=$text.$prependSpace.$words[$i];
		    }
		    $prependSpace = " ";
		} elsif ($words[$i] =~ /^[\p{IsSc}\(\[\{\¿\¡]+$/) {
			#perform right shift on currency and other random punctuation items
			$text = $text.$prependSpace.$words[$i];
			$prependSpace = "";
		} elsif ($words[$i] =~ /^[\,\.\?\!\:\;\\\%\}\]\)]+$/){
		    if (($language eq "fr") && ($words[$i] =~ /^[\?\!\:\;\\\%]$/)) {
			#these punctuations are prefixed with a non-breakable space in french
			$text .= " "; }
			#perform left shift on punctuation items
			$text=$text.$words[$i];
			$prependSpace = " ";
		} elsif (($language eq "en") && ($i>0) && ($words[$i] =~ /^[\'][\p{IsAlpha}]/) && ($words[$i-1] =~ /[\p{IsAlnum}]$/)) {
			#left-shift the contraction for English
			$text=$text.$words[$i];
			$prependSpace = " ";
		} elsif (($language eq "cs") && ($i>1) && ($words[$i-2] =~ /^[0-9]+$/) && ($words[$i-1] =~ /^[.,]$/) && ($words[$i] =~ /^[0-9]+$/)) {
			#left-shift floats in Czech
			$text=$text.$words[$i];
			$prependSpace = " ";
		}  elsif ((($language eq "fr") ||($language eq "it")) && ($i<=(scalar(@words)-2)) && ($words[$i] =~ /[\p{IsAlpha}][\']$/) && ($words[$i+1] =~ /^[\p{IsAlpha}]/)) {
			#right-shift the contraction for French and Italian
			$text = $text.$prependSpace.$words[$i];
			$prependSpace = "";
		} elsif (($language eq "cs") && ($i<(scalar(@words)-3))
				&& ($words[$i] =~ /[\p{IsAlpha}]$/)
				&& ($words[$i+1] =~ /^[-–]$/)
				&& ($words[$i+2] =~ /^li$|^mail.*/i)
				) {
			#right-shift "-li" in Czech and a few Czech dashed words (e-mail)
			$text = $text.$prependSpace.$words[$i].$words[$i+1];
			$i++; # advance over the dash
			$prependSpace = "";
		} elsif ($words[$i] =~ /^[\'\"„“`]+$/) {
			#combine punctuation smartly
      my $normalized_quo = $words[$i];
      $normalized_quo = '"' if $words[$i] =~ /^[„“”]+$/;
      $quoteCount{$normalized_quo} = 0
              if !defined $quoteCount{$normalized_quo};
      if ($language eq "cs" && $words[$i] eq "„") {
        # this is always the starting quote in Czech
        $quoteCount{$normalized_quo} = 0;
      }
      if ($language eq "cs" && $words[$i] eq "“") {
        # this is usually the ending quote in Czech
        $quoteCount{$normalized_quo} = 1;
      }
			if (($quoteCount{$normalized_quo} % 2) eq 0) {
				if(($language eq "en") && ($words[$i] eq "'") && ($i > 0) && ($words[$i-1] =~ /[s]$/)) {
					#single quote for posesssives ending in s... "The Jones' house"
					#left shift
					$text=$text.$words[$i];
					$prependSpace = " ";
				} else {
					#right shift
					$text = $text.$prependSpace.$words[$i];
					$prependSpace = "";
					$quoteCount{$normalized_quo} ++;

				}
			} else {
				#left shift
				$text=$text.$words[$i];
				$prependSpace = " ";
				$quoteCount{$normalized_quo} ++;

			}
			
		} else {
			$text=$text.$prependSpace.$words[$i];
			$prependSpace = " ";
		}
	}
	
	# clean up spaces at head and tail of each line as well as any double-spacing
	$text =~ s/ +/ /g;
	$text =~ s/\n /\n/g;
	$text =~ s/ \n/\n/g;
	$text =~ s/^ //g;
	$text =~ s/ $//g;
	
	#add trailing break
	#$text .= "\n" unless $text =~ /\n$/;

  $text =~ s/^([[:punct:]\s]*)([[:alpha:]])/ucsecondarg($1, $2)/e if $UPPERCASE_SENT;

	return $text;
}

sub startsWithCJKChar {
    my ($str) = @_;
    return 0 if length($str) == 0;
    my $firstChar = substr($str, 0, 1);
    return &charIsCJK($firstChar);
}

sub endsWithCJKChar {
    my ($str) = @_;
    return 0 if length($str) == 0;
    my $lastChar = substr($str, length($str)-1, 1);
    return &charIsCJK($lastChar);
}

# Given a string consisting of one character, returns true iff the character
# is a CJK (Chinese/Japanese/Korean) character
sub charIsCJK {
    my ($char) = @_;
    # $char should be a string of length 1
    my $codepoint = &codepoint_dec($char);
    
    # The following is based on http://en.wikipedia.org/wiki/Basic_Multilingual_Plane#Basic_Multilingual_Plane

    # Hangul Jamo (1100–11FF)
    return 1 if (&between_hexes($codepoint, '1100', '11FF'));

    # CJK Radicals Supplement (2E80–2EFF)
    # Kangxi Radicals (2F00–2FDF)
    # Ideographic Description Characters (2FF0–2FFF)
    # CJK Symbols and Punctuation (3000–303F)
    # Hiragana (3040–309F)
    # Katakana (30A0–30FF)
    # Bopomofo (3100–312F)
    # Hangul Compatibility Jamo (3130–318F)
    # Kanbun (3190–319F)
    # Bopomofo Extended (31A0–31BF)
    # CJK Strokes (31C0–31EF)
    # Katakana Phonetic Extensions (31F0–31FF)
    # Enclosed CJK Letters and Months (3200–32FF)
    # CJK Compatibility (3300–33FF)
    # CJK Unified Ideographs Extension A (3400–4DBF)
    # Yijing Hexagram Symbols (4DC0–4DFF)
    # CJK Unified Ideographs (4E00–9FFF)
    # Yi Syllables (A000–A48F)
    # Yi Radicals (A490–A4CF)
    return 1 if (&between_hexes($codepoint, '2E80', 'A4CF'));

    # Phags-pa (A840–A87F)
    return 1 if (&between_hexes($codepoint, 'A840', 'A87F'));

    # Hangul Syllables (AC00–D7AF)
    return 1 if (&between_hexes($codepoint, 'AC00', 'D7AF'));

    # CJK Compatibility Ideographs (F900–FAFF)
    return 1 if (&between_hexes($codepoint, 'F900', 'FAFF'));

    # CJK Compatibility Forms (FE30–FE4F)
    return 1 if (&between_hexes($codepoint, 'FE30', 'FE4F'));

    # Range U+FF65–FFDC encodes halfwidth forms, of Katakana and Hangul characters
    return 1 if (&between_hexes($codepoint, 'FF65', 'FFDC'));

    # Supplementary Ideographic Plane 20000–2FFFF
    return 1 if (&between_hexes($codepoint, '20000', '2FFFF'));

    return 0;
}

# Returns the code point of a Unicode char, represented as a decimal number
sub codepoint_dec {
    if (my $char = shift) {
	return unpack('U0U*', $char);
    }
}

sub between_hexes {
    my ($num, $left, $right) = @_;
    return $num >= hex($left) && $num <= hex($right);
}
