#!/usr/bin/perl -w

# Sample Tokenizer
# written by Josh Schroeder, based on code by Philipp Koehn

use FindBin qw($Bin);
use strict;
use Thread;
use utf8;

use Cwd 'abs_path';
use File::Basename;

my %NONBREAKING_PREFIX = ();
my $language = "en";
my $MODEL = "processor/truecase-model.en";
my $dirname = abs_path(dirname(__FILE__));
my $QUIET = 0;
my $HELP = 0;

while (@ARGV) {
  $_ = shift;
  /^-l$/ && ($language = shift, next);
  /^-c$/ && ($MODEL = shift, next);
  /^-d$/ && ($dirname = shift, next);
  /^-q$/ && ($QUIET = 1, next);
  /^-h$/ && ($HELP = 1, next);
}

if ($HELP) {
  print "Usage ./processor.perl (-l [en|de|...]) -d nonbreaking_prefixes_dirname -c truecase_model\n";
  exit;
}
if (!$QUIET) {
  print STDERR "Tokenizer v3\n";
  print STDERR "Language: $language\n";
}

my $mydir = "$dirname/nonbreaking_prefixes";

######### LOAD TOKENIZER MODELS ############

sub load_prefixes {
  my ($language, $PREFIX_REF) = @_;
  
  my $prefixfile = "$mydir/nonbreaking_prefix.$language";
  
  #default back to English if we don't have a language-specific prefix file
  if (!(-e $prefixfile)) {
    $prefixfile = "$mydir/nonbreaking_prefix.en";
    print STDERR "WARNING: No known abbreviations for language '$language', attempting fall-back to English version...\n";
    die ("ERROR: No abbreviations files found in $mydir\n") unless (-e $prefixfile);
  }
  
  if (-e "$prefixfile") {
    open(PREFIX, "<:utf8", "$prefixfile");
    while (<PREFIX>) {
      my $item = $_;
      chomp($item);
      if (($item) && (substr($item,0,1) ne "#")) {
        if ($item =~ /(.*)[\s]+(\#NUMERIC_ONLY\#)/) {
          $PREFIX_REF->{$1} = 2;
        } else {
          $PREFIX_REF->{$item} = 1;
        }
      }
    }
    close(PREFIX);
  }
}

load_prefixes($language,\%NONBREAKING_PREFIX);

if (scalar(%NONBREAKING_PREFIX) eq 0){
  print STDERR "Warning: No known abbreviations for language '$language'\n";
}


######### LOAD TRUCASER MODELS ############

my (%BEST,%KNOWN);
open(MODEL,$MODEL) || die("ERROR: could not open '$MODEL'");
binmode(MODEL, ":utf8");
while(<MODEL>) {
  my ($word,@OPTIONS) = split;
  $BEST{ lc($word) } = $word;
  $KNOWN{ $word } = 1;
  for(my $i=1;$i<$#OPTIONS;$i+=2) {
    $KNOWN{ $OPTIONS[$i] } = 1;
  }
}
close(MODEL);

my %SENTENCE_END = ("."=>1,":"=>1,"?"=>1,"!"=>1);
my %DELAYED_SENTENCE_START = ("("=>1,"["=>1,"\""=>1,"'"=>1);

# lowercase even in headline
my %ALWAYS_LOWER;
foreach ("a","after","against","al-.+","and","any","as","at","be","because","between","by","during","el-.+","for","from","his","in","is","its","last","not","of","off","on","than","the","their","this","to","was","were","which","will","with") { $ALWAYS_LOWER{$_} = 1; }



############### TOKENIZE ####################

sub tokenize {
  my($text) = @_;

  #print STDERR "OLD: ".$text."\n";

  normalize_punctuation($text);

  chomp($text);
  $text = " $text ";
  
  # seperate out all "other" special characters
  $text =~ s/([^\p{IsAlnum}\s\.\'\`\,\-])/ $1 /g;
  
  #multi-dots stay together
  $text =~ s/\.([\.]+)/ DOTMULTI$1/g;
  while($text =~ /DOTMULTI\./) {
    $text =~ s/DOTMULTI\.([^\.])/DOTDOTMULTI $1/g;
    $text =~ s/DOTMULTI\./DOTDOTMULTI/g;
  }

  # seperate out "," except if within numbers (5,300)
  $text =~ s/([^\p{IsN}])[,]([^\p{IsN}])/$1 , $2/g;
  # separate , pre and post number
  $text =~ s/([\p{IsN}])[,]([^\p{IsN}])/$1 , $2/g;
  $text =~ s/([^\p{IsN}])[,]([\p{IsN}])/$1 , $2/g;
        
  # turn `into '
  $text =~ s/\`/\'/g;
  
  #turn '' into "
  $text =~ s/\'\'/ \" /g;

  if ($language eq "en") {
    #split contractions right
    $text =~ s/([^\p{IsAlpha}])[']([^\p{IsAlpha}])/$1 ' $2/g;
    $text =~ s/([^\p{IsAlpha}\p{IsN}])[']([\p{IsAlpha}])/$1 ' $2/g;
    $text =~ s/([\p{IsAlpha}])[']([^\p{IsAlpha}])/$1 ' $2/g;
    $text =~ s/([\p{IsAlpha}])[']([\p{IsAlpha}])/$1 '$2/g;
    #special case for "1990's"
    $text =~ s/([\p{IsN}])[']([s])/$1 '$2/g;
  } elsif (($language eq "fr") or ($language eq "it")) {
    #split contractions left        
    $text =~ s/([^\p{IsAlpha}])[']([^\p{IsAlpha}])/$1 ' $2/g;
    $text =~ s/([^\p{IsAlpha}])[']([\p{IsAlpha}])/$1 ' $2/g;
    $text =~ s/([\p{IsAlpha}])[']([^\p{IsAlpha}])/$1 ' $2/g;
    $text =~ s/([\p{IsAlpha}])[']([\p{IsAlpha}])/$1' $2/g;
  } else {
    $text =~ s/\'/ \' /g;
  }
  
  #word token method
  my @words = split(/\s/,$text);
  $text = "";
  for (my $i=0;$i<(scalar(@words));$i++) {
    my $word = $words[$i];
    if ( $word =~ /^(\S+)\.$/) {
      my $pre = $1;
      if (($pre =~ /\./ && $pre =~ /\p{IsAlpha}/) || ($NONBREAKING_PREFIX{$pre} && $NONBREAKING_PREFIX{$pre}==1) || ($i<scalar(@words)-1 && ($words[$i+1] =~ /^[\p{IsLower}]/))) {
        #no change
      } elsif (($NONBREAKING_PREFIX{$pre} && $NONBREAKING_PREFIX{$pre}==2) && ($i<scalar(@words)-1 && ($words[$i+1] =~ /^[0-9]+/))) {
        #no change
      } else {
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
  while($text =~ /DOTDOTMULTI/) {
    $text =~ s/DOTDOTMULTI/DOTMULTI./g;
  }
  $text =~ s/DOTMULTI/./g;
  
  #ensure final line break
  #$text .= "\n" unless $text =~ /\n$/;

  #print STDERR "NEW: ".$text."\n";

  chomp($text);
  return $text;
}

sub normalize_punctuation {
  my $line = $_[0];
  $_ = $line;
  s/\r//g;
  # remove extra spaces
  s/\(/ \(/g;
  s/\)/\) /g; s/ +/ /g;
  s/\) ([\.\!\:\?\;\,])/\)$1/g;
  s/\( /\(/g;
  s/ \)/\)/g;
  s/(\d) \%/$1\%/g;
  s/ :/:/g;
  s/ ;/;/g;
  # normalize unicode punctuation
  s/„/\"/g;
  s/“/\"/g;
  s/”/\"/g;
  s/–/-/g;
  s/—/ - /g; s/ +/ /g;
  s/´/\'/g;
  s/([a-z])‘([a-z])/$1\'$2/gi;
  s/([a-z])’([a-z])/$1\'$2/gi;
  s/‘/\"/g;
  s/‚/\"/g;
  s/’/\"/g;
  s/''/\"/g;
  s/´´/\"/g;
  s/…/.../g;
  # French quotes
  s/ « / \"/g;
  s/« /\"/g;
  s/«/\"/g;
  s/ » /\" /g;
  s/ »/\"/g;
  s/»/\"/g;
  # handle pseudo-spaces
  s/ \%/\%/g;
  s/nº /nº /g;
  s/ :/:/g;
  s/ ºC/ ºC/g;
  s/ cm/ cm/g;
  s/ \?/\?/g;
  s/ \!/\!/g;
  s/ ;/;/g;
  s/, /, /g; s/ +/ /g;

  # English "quotation," followed by comma, style
  if ($language eq "en") {
    s/\"([,\.]+)/$1\"/g;
  }
  # Czech is confused
  elsif ($language eq "cs" || $language eq "cz") {
  }
  # German/Spanish/French "quotation", followed by comma, style
  else {
    s/,\"/\",/g;        
    s/(\.+)\"(\s*[^<])/\"$1$2/g; # don't fix period at end of sentence
  }

  print STDERR $_ if /﻿/;

  if ($language eq "de" || $language eq "es" || $language eq "cz" || $language eq "cs" || $language eq "fr") {
    s/(\d) (\d)/$1,$2/g;
  }
  else {
    s/(\d) (\d)/$1.$2/g;
  }
  return $_;
}


##################### PREPROCESS #######################

sub preprocess {
  my $line = $_[0];
  $_ = $line;
  #print STDERR "ORIG: ".$_."\n";
  #chop;

  my ($WORD,$MARKUP) = split_xml($_);
  my $sentence_start = 1;
  my $text = "";
  for(my $i=0;$i<=$#$WORD;$i++) {
    $text .= " " if $i;
    $text .= $$MARKUP[$i];

    $$WORD[$i] =~ /^([^\|]+)(.*)/;
    my $word = $1;
    my $otherfactors = $2;

    if ($sentence_start && defined($BEST{lc($word)})) {
      $text .= $BEST{lc($word)}; # truecase sentence start
    }
    elsif (defined($KNOWN{$word})) {
      $text .= $word; # don't change known words
    }
    elsif (defined($BEST{lc($word)})) {
      $text .= $BEST{lc($word)}; # truecase otherwise unknown words
    }
    else {
      $text .= $word; # unknown, nothing to do
    }
    $text .= $otherfactors;

    if    ( defined($SENTENCE_END{ $word }))           { $sentence_start = 1; }
    elsif (!defined($DELAYED_SENTENCE_START{ $word })) { $sentence_start = 0; }
  }
  $text .= " ".$$MARKUP[$#$MARKUP];
  #print STDERR "PREPROC: ".$_."\n";
  return $text;
}

# store away xml markup
sub split_xml {
  my ($line) = @_;
  my (@WORD,@MARKUP);
  my $i = 0;
  $MARKUP[0] = "";
  while($line =~ /\S/) {
    if ($line =~ /^\s*(<\S[^>]*>)(.*)$/) {
      $MARKUP[$i] .= $1." ";
      $line = $2;
    }
    elsif ($line =~ /^\s*(\S+)(.*)$/) {
      $WORD[$i++] = $1;
      $MARKUP[$i] = "";
      $line = $2;
    }
    else {
      die("ERROR: huh? $line\n");
    }
  }
  chop($MARKUP[$#MARKUP]);
  return (\@WORD,\@MARKUP);
}




############# DETOKENIZE ###################

sub detokenize {
  my($text) = @_;
  chomp($text);
  $text = " $text ";
  
  my $word;
  my $i;
  my @words = split(/ /,$text);
  $text = "";
  my %quoteCount =  ("\'"=>0,"\""=>0);
  my $prependSpace = " ";
  for ($i=0;$i<(scalar(@words));$i++) {                
    if ($words[$i] =~ /^[\p{IsSc}\(\[\{\¿\¡]+$/) {
      #perform right shift on currency and other random punctuation items
      $text = $text.$prependSpace.$words[$i];
      $prependSpace = "";
    } elsif ($words[$i] =~ /^[\,\.\?\!\:\;\\\%\}\]\)]+$/){
      #perform left shift on punctuation items
      $text=$text.$words[$i];
      $prependSpace = " ";
    } elsif (($language eq "en") && ($i>0) && ($words[$i] =~ /^[\'][\p{IsAlpha}]/) && ($words[$i-1] =~ /[\p{IsAlnum}]$/)) {
      #left-shift the contraction for English
      $text=$text.$words[$i];
      $prependSpace = " ";
    } elsif (($language eq "fr") && ($i<(scalar(@words)-2)) && ($words[$i] =~ /[\p{IsAlpha}][\']$/) && ($words[$i+1] =~ /^[\p{IsAlpha}]/)) {
      #right-shift the contraction for French
      $text = $text.$prependSpace.$words[$i];
      $prependSpace = "";
    } elsif ($words[$i] =~ /^[\'\"]+$/) {
      #combine punctuation smartly
      if (($quoteCount{$words[$i]} % 2) eq 0) {
        if(($language eq "en") && ($words[$i] eq "'") && ($i > 0) && ($words[$i-1] =~ /[s]$/)) {
         #single quote for posesssives ending in s... "The Jones' house"
         #left shift
         $text=$text.$words[$i];
         $prependSpace = " ";
        } else {
         #right shift
         $text = $text.$prependSpace.$words[$i];
         $prependSpace = "";
         $quoteCount{$words[$i]} = $quoteCount{$words[$i]} + 1;

        }
      } else {
         #left shift
         $text=$text.$words[$i];
         $prependSpace = " ";
         $quoteCount{$words[$i]} = $quoteCount{$words[$i]} + 1;

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

  chomp($text);
  return $text;
}


############# POSTPROCESS ###################

sub postprocess {
  my $line = $_[0];
  chomp($line);
  $line =~ s/^\s+//;
  $line =~ s/\s+$//;
  my @WORD  = split(/\s+/,$line);

  # uppercase at sentence start
  my $sentence_start = 1;
  for(my $i=0;$i<scalar(@WORD);$i++) {
    &uppercase(\$WORD[$i]) if $sentence_start;
    if (defined($SENTENCE_END{ $WORD[$i] })) { $sentence_start = 1; }
    elsif (!defined($DELAYED_SENTENCE_START{$WORD[$i] })) { $sentence_start = 0; }
  }

  # output
  my $first = 1;
  my $text = "";
  foreach (@WORD) {
    $text .= " " unless $first;
    $first = 0;
    $text .= $_;
  }
  chomp($text);
  return $text;
}

sub uppercase {
  my ($W) = @_;
  $$W = uc(substr($$W,0,1)).substr($$W,1);
}




